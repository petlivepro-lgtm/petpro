"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { bookingRequest, tutorFeedbackInput, reservationInput } from "@mylivepet/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Tutor solicita um agendamento → cria appointment REQUESTED (origin TUTOR). */
export async function requestBooking(formData: FormData) {
  const parsed = bookingRequest.safeParse({
    pet_id: formData.get("pet_id"),
    service_type_id: formData.get("service_type_id"),
    scheduled_at: formData.get("scheduled_at"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) redirect("/agendar?erro=1");

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) redirect("/agendar?erro=1");

  const { error } = await supabase.from("appointment").insert({
    tenant_id: ctx.tenantId,
    tutor_id: ctx.tutorId,
    pet_id: parsed.data.pet_id,
    service_type_id: parsed.data.service_type_id,
    scheduled_at: new Date(parsed.data.scheduled_at).toISOString(),
    notes: parsed.data.notes,
    origin: "TUTOR",
    status: "REQUESTED",
  });
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

  // snapshot dos preços atuais
  const ids = parsed.data.items.map((i) => i.product_id);
  const { data: products } = await supabase
    .from("product")
    .select("id, price_cents")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids);
  const priceById = new Map((products ?? []).map((p) => [p.id, p.price_cents]));

  const { data: reservation, error } = await supabase
    .from("product_reservation")
    .insert({
      tenant_id: ctx.tenantId,
      tutor_id: ctx.tutorId,
      status: "RESERVED",
      note: parsed.data.note,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(), // 48h
    })
    .select("id")
    .single();
  if (error || !reservation) redirect("/produtos?erro=1");

  await supabase.from("product_reservation_item").insert(
    parsed.data.items.map((i) => ({
      tenant_id: ctx.tenantId,
      reservation_id: reservation.id,
      product_id: i.product_id,
      quantity: i.quantity,
      price_cents: priceById.get(i.product_id) ?? 0,
    })),
  );

  revalidatePath("/produtos");
  redirect("/produtos?reservado=1");
}
