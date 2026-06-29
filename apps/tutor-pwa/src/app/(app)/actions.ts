"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import {
  bookingRequest,
  tutorFeedbackInput,
  reservationInput,
  reservationItemCancel,
  reservationCancel,
} from "@mylivepet/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Tutor solicita um agendamento → cria um appointment REQUESTED (origin TUTOR)
 * por serviço escolhido, todos com o mesmo request_group_id para o petshop
 * confirmar/recusar tudo de uma vez ou individualmente.
 */
export async function requestBooking(formData: FormData) {
  const parsed = bookingRequest.safeParse({
    pet_id: formData.get("pet_id"),
    service_type_ids: formData.getAll("service_type_id"),
    scheduled_at: formData.get("scheduled_at"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) redirect("/agendar?erro=1");

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) redirect("/agendar?erro=1");

  const requestGroupId = crypto.randomUUID();
  const scheduledAt = new Date(parsed.data.scheduled_at).toISOString();
  const rows = parsed.data.service_type_ids.map((service_type_id) => ({
    tenant_id: ctx.tenantId,
    tutor_id: ctx.tutorId,
    pet_id: parsed.data.pet_id,
    service_type_id,
    scheduled_at: scheduledAt,
    notes: parsed.data.notes,
    origin: "TUTOR" as const,
    status: "REQUESTED" as const,
    request_group_id: requestGroupId,
  }));

  const { error } = await supabase.from("appointment").insert(rows);
  if (error) redirect("/agendar?erro=1");

  revalidatePath("/");
  redirect("/?agendado=1");
}

/** Tutor avalia um atendimento finalizado (feedback TUTOR_TO_PETSHOP). */
export async function submitTutorFeedback(formData: FormData) {
  const parsed = tutorFeedbackInput.safeParse({
    appointment_id: formData.get("appointment_id"),
    rating: Number(formData.get("rating")),
    comment: formData.get("comment") ?? undefined,
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return;

  await supabase.from("feedback").insert({
    tenant_id: ctx.tenantId,
    appointment_id: parsed.data.appointment_id,
    direction: "TUTOR_TO_PETSHOP",
    rating: parsed.data.rating,
    comment: parsed.data.comment,
  });
  revalidatePath("/");
  revalidatePath("/atendimentos");
}

/** Tutor reserva produtos para pagar na loja (sem pagamento online). */
export async function createReservation(formData: FormData) {
  const raw = formData.get("items");
  let items: { product_id: string; quantity: number }[] = [];
  try {
    items = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    redirect("/produtos?erro=1");
  }
  const parsed = reservationInput.safeParse({ items, note: formData.get("note") ?? undefined });
  if (!parsed.success) redirect("/produtos?erro=1");

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) redirect("/produtos?erro=1");

  // debita o estoque e cria a reserva de forma atômica (evita corrida entre tutores)
  const { error } = await supabase.rpc("reserve_products", {
    p_tenant_id: ctx.tenantId,
    p_items: parsed.data.items,
    p_note: parsed.data.note ?? null,
  });
  if (error) redirect("/produtos?erro=estoque");

  revalidatePath("/produtos");
  redirect("/produtos?reservado=1");
}

/** Tutor cancela um item específico de uma reserva ativa; devolve o estoque. */
export async function cancelReservationItem(formData: FormData) {
  const parsed = reservationItemCancel.safeParse({ item_id: formData.get("item_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_reservation_item", { p_item_id: parsed.data.item_id });

  revalidatePath("/produtos");
}

/** Tutor cancela uma reserva inteira; devolve o estoque de todos os itens. */
export async function cancelReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({ reservation_id: formData.get("reservation_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_reservation", { p_reservation_id: parsed.data.reservation_id });

  revalidatePath("/produtos");
}
