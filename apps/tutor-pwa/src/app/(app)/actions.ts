"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { dispatchNotifications } from "@/lib/notify";
import {
  appointmentCancel,
  bookingRequest,
  isWithinSchedule,
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
 * Grava os adicionais escolhidos na solicitação (0056).
 *
 * Nome e preço vêm do catálogo aqui no servidor, não do formulário: é esse valor
 * que o petshop vai cobrar. Id inativo ou de outro petshop não é encontrado e
 * fica de fora.
 *
 * O pedido já existe quando isto roda: se a gravação falhar, o tutor continua
 * com o horário solicitado e o petshop acerta os extras no balcão — derrubar a
 * solicitação inteira por causa de um adicional seria pior.
 */
async function attachAddons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  appointmentId: string,
  addonIds: string[],
): Promise<void> {
  if (addonIds.length === 0) return;

  const { data: addons } = await supabase
    .from("service_addon")
    .select("id, name, price_cents")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .in("id", addonIds);
  if (!addons || addons.length === 0) return;

  await supabase.from("appointment_addon").insert(
    addons.map((addon) => ({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      service_addon_id: addon.id,
      name: addon.name,
      price_cents: addon.price_cents,
    })),
  );
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
    service_addon_ids: formData.getAll("service_addon_id"),
    collaborator_id: formData.get("collaborator_id"),
    scheduled_at: formData.get("scheduled_at"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) redirect("/agendar?erro=1");

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) redirect("/agendar?erro=1");

  const scheduledAt = new Date(parsed.data.scheduled_at).toISOString();

  // O formulário só oferece profissionais e horários dentro do expediente, mas
  // os campos são adulteráveis: reconfere aqui (e o trigger de 0054 no banco
  // barra quem tentar inserir direto pela API).
  const { data: collaborator } = await supabase
    .from("collaborator")
    .select("id, collaborator_schedule(weekday, start_time, end_time)")
    .eq("id", parsed.data.collaborator_id)
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .maybeSingle();
  if (!collaborator) redirect("/agendar?erro=1");
  if (!isWithinSchedule(collaborator.collaborator_schedule, scheduledAt)) {
    redirect("/agendar?erro=grade");
  }

  const requestGroupId = crypto.randomUUID();
  // Ids gerados aqui, e não pelo default do banco, para saber de antemão qual é
  // a primeira linha do grupo — é nela que os adicionais são gravados.
  const ids = parsed.data.service_type_ids.map(() => crypto.randomUUID());
  const rows = parsed.data.service_type_ids.map((service_type_id, index) => ({
    id: ids[index]!,
    tenant_id: ctx.tenantId,
    tutor_id: ctx.tutorId,
    pet_id: parsed.data.pet_id,
    service_type_id,
    collaborator_id: parsed.data.collaborator_id,
    scheduled_at: scheduledAt,
    notes: parsed.data.notes,
    origin: "TUTOR" as const,
    status: "REQUESTED" as const,
    request_group_id: requestGroupId,
  }));

  const { error } = await supabase.from("appointment").insert(rows);
  // SLOT_TAKEN vem do trigger appointment_slot_guard (0014): outro tutor
  // reservou o mesmo colaborador+horário entre a escolha e o envio.
  if (error) {
    if (error.message.includes("SLOT_TAKEN")) redirect("/agendar?erro=horario");
    // OFF_SCHEDULE vem do trigger appointment_within_schedule (0054).
    redirect(error.message.includes("OFF_SCHEDULE") ? "/agendar?erro=grade" : "/agendar?erro=1");
  }

  await attachAddons(supabase, ctx.tenantId, ids[0]!, parsed.data.service_addon_ids ?? []);

  // Antes do redirect: redirect() lança, e o push nunca sairia depois dele.
  await dispatchNotifications(ctx.tenantId);

  revalidatePath("/");
  redirect("/?agendado=1");
}

/**
 * Tutor desmarca um agendamento seu, com motivo. Um pedido pode ter vários
 * serviços no mesmo horário (request_group_id) — o card manda todos os ids
 * quando o tutor escolhe desmarcar o pedido inteiro.
 *
 * Quem decide se pode é a RPC cancel_appointment (0055): o tutor só cancela o
 * que é dele, ainda não iniciado e antes do horário chegar. O petshop é avisado
 * pelo gatilho notify_booking_cancelled (0040).
 */
export async function cancelBooking(formData: FormData) {
  const parsed = appointmentCancel.safeParse({
    appointment_ids: formData.getAll("appointment_ids"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/atendimentos?erro=motivo");

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) redirect("/atendimentos?erro=1");

  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_ids: parsed.data.appointment_ids,
    p_reason: parsed.data.reason,
  });
  if (error) redirect("/atendimentos?erro=cancelamento");

  // Antes do redirect: redirect() lança, e o push nunca sairia depois dele.
  await dispatchNotifications(ctx.tenantId);

  revalidatePath("/");
  revalidatePath("/atendimentos");
  redirect("/atendimentos?cancelado=1");
}

/** Tutor avalia um atendimento finalizado (feedback TUTOR_TO_PETSHOP). */
export async function submitTutorFeedback(formData: FormData) {
  const raw = formData.get("responses");
  let responses: unknown = [];
  try {
    responses = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return;
  }
  const parsed = tutorFeedbackInput.safeParse({
    appointment_id: formData.get("appointment_id"),
    responses,
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return;

  // Compatibilidade: mantém rating/comment a partir do 1º campo de cada tipo.
  const firstStars = parsed.data.responses.find((r) => r.type === "STARS");
  const firstText = parsed.data.responses.find((r) => r.type === "TEXT");

  await supabase.from("feedback").insert({
    tenant_id: ctx.tenantId,
    appointment_id: parsed.data.appointment_id,
    direction: "TUTOR_TO_PETSHOP",
    responses: parsed.data.responses,
    rating: typeof firstStars?.value === "number" ? firstStars.value : null,
    comment: typeof firstText?.value === "string" ? firstText.value : null,
  });
  await dispatchNotifications(ctx.tenantId);
  revalidatePath("/");
  revalidatePath("/atendimentos");
}

/** Tutor reserva produtos para pagar na loja (sem pagamento online). */
export async function createReservation(formData: FormData) {
  const raw = formData.get("items");
  let items: { product_id: string; variant_id?: string; quantity: number }[] = [];
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

  // debita o estoque (da variação, quando houver) e cria a reserva de forma
  // atômica — evita corrida entre tutores disputando a última unidade
  const { error } = await supabase.rpc("reserve_products", {
    p_tenant_id: ctx.tenantId,
    p_items: parsed.data.items,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) {
    redirect(
      error.message.includes("Selecione a variação")
        ? "/produtos?erro=variacao"
        : "/produtos?erro=estoque",
    );
  }

  // Antes do redirect: redirect() lança, e o push nunca sairia depois dele.
  await dispatchNotifications(ctx.tenantId);

  revalidatePath("/produtos");
  redirect("/produtos?reservado=1");
}

/** Tutor cancela um item específico de uma reserva ativa; devolve o estoque. */
export async function cancelReservationItem(formData: FormData) {
  const parsed = reservationItemCancel.safeParse({ item_id: formData.get("item_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_reservation_item", { p_item_id: parsed.data.item_id });

  const ctx = await getTutorContext(supabase);
  if (ctx) await dispatchNotifications(ctx.tenantId);

  revalidatePath("/produtos");
}

/** Tutor cancela uma reserva inteira; devolve o estoque de todos os itens. */
export async function cancelReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({ reservation_id: formData.get("reservation_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("cancel_reservation", { p_reservation_id: parsed.data.reservation_id });

  const ctx = await getTutorContext(supabase);
  if (ctx) await dispatchNotifications(ctx.tenantId);

  revalidatePath("/produtos");
}

/**
 * Tutor dispensa o aviso de uma reserva recusada. Vai para o banco (e não para
 * o localStorage) para que a dispensa valha em qualquer aparelho.
 */
export async function markRejectionSeen(formData: FormData) {
  const parsed = reservationCancel.safeParse({ reservation_id: formData.get("reservation_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("mark_rejection_seen", { p_reservation_id: parsed.data.reservation_id });

  revalidatePath("/");
  revalidatePath("/produtos");
}
