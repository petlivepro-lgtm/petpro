"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { dispatchNotifications } from "@/lib/notify";
import {
  appointmentCancel,
  appointmentStatusUpdate,
  appointmentStatusBatchUpdate,
  bookingRequest,
  canMutateAsRole,
  isWithinSchedule,
  paidReservationInput,
  reservationCancel,
  reservationReject,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

/**
 * Solicitações e reservas são gestão do petshop: VIEWER só lê e COLLABORATOR
 * nem enxerga essas telas (a RLS também o barra no banco).
 */
async function canMutate(supabase: Awaited<ReturnType<typeof createClient>>) {
  const tenant = await getActiveTenant(supabase);
  return !!tenant && canMutateAsRole(tenant.role);
}

/**
 * Mesma checagem, mas devolvendo o tenant — quem mexe na agenda precisa dele
 * para empurrar o aviso ao colaborador (ver lib/notify.ts).
 */
async function tenantIfCanMutate(supabase: Awaited<ReturnType<typeof createClient>>) {
  const tenant = await getActiveTenant(supabase);
  return tenant && canMutateAsRole(tenant.role) ? tenant : null;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Grava os adicionais escolhidos no agendamento (0056).
 *
 * Nome e preço vêm do catálogo aqui no servidor, não do formulário: é esse valor
 * que vira receita ao concluir, então não pode depender do que o navegador
 * mandou. Id inativo ou de outro petshop não é encontrado e fica de fora.
 *
 * Devolve a mensagem de erro, ou undefined quando deu certo. O agendamento já
 * existe neste ponto: falhar aqui deixa o horário marcado sem os extras, e é
 * isso que a mensagem precisa dizer.
 */
async function attachAddons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  appointmentId: string,
  addonIds: string[],
): Promise<string | undefined> {
  if (addonIds.length === 0) return;

  const { data: addons } = await supabase
    .from("service_addon")
    .select("id, name, price_cents")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .in("id", addonIds);
  if (!addons || addons.length === 0) return;

  const { error } = await supabase.from("appointment_addon").insert(
    addons.map((addon) => ({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      service_addon_id: addon.id,
      name: addon.name,
      price_cents: addon.price_cents,
    })),
  );
  if (error) {
    return "Agendamento criado, mas os adicionais não foram salvos. Edite o atendimento para incluí-los.";
  }
}

/**
 * A loja agenda em nome do tutor (telefone, WhatsApp ou balcão). Nasce
 * CONFIRMED — diferente da solicitação do tutor, que entra como REQUESTED e
 * precisa de aval. Cada serviço escolhido vira uma linha, todas irmãs pelo
 * request_group_id (o trigger de slot deixa as irmãs dividirem o horário).
 */
export async function createStaffBooking(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = bookingRequest.safeParse({
    pet_id: formData.get("pet_id"),
    service_type_ids: formData.getAll("service_type_id"),
    service_addon_ids: formData.getAll("service_addon_id"),
    collaborator_id: formData.get("collaborator_id"),
    scheduled_at: formData.get("scheduled_at"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  if (!(await canMutate(supabase))) {
    return { ok: false, error: "Seu acesso é somente leitura" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada" };

  // Tenant e tutor vêm do pet (a RLS já limita ao tenant), nunca do formulário.
  const { data: pet } = await supabase
    .from("pet")
    .select("id, tenant_id, tutor_id")
    .eq("id", parsed.data.pet_id)
    .maybeSingle();
  if (!pet) return { ok: false, error: "Pet não encontrado" };

  // Fora do encaixe, o balcão também respeita o expediente do profissional.
  const { data: collaborator } = await supabase
    .from("collaborator")
    .select("id, collaborator_schedule(weekday, start_time, end_time)")
    .eq("id", parsed.data.collaborator_id)
    .eq("tenant_id", pet.tenant_id)
    .maybeSingle();
  if (!collaborator) return { ok: false, error: "Profissional não encontrado" };

  const offSchedule = formData.get("off_schedule") === "1";
  if (
    !offSchedule &&
    !isWithinSchedule(collaborator.collaborator_schedule, parsed.data.scheduled_at)
  ) {
    return {
      ok: false,
      error:
        'Esse profissional não atende nesse dia e horário. Marque "Encaixe" para agendar assim mesmo.',
    };
  }

  const requestGroupId = crypto.randomUUID();
  // Ids gerados aqui, e não pelo default do banco, para saber de antemão qual é
  // a primeira linha do grupo — é nela que os adicionais são gravados.
  const ids = parsed.data.service_type_ids.map(() => crypto.randomUUID());
  const { error } = await supabase.from("appointment").insert(
    parsed.data.service_type_ids.map((serviceTypeId, index) => ({
      id: ids[index]!,
      tenant_id: pet.tenant_id,
      pet_id: pet.id,
      tutor_id: pet.tutor_id,
      service_type_id: serviceTypeId,
      collaborator_id: parsed.data.collaborator_id,
      staff_id: user.id,
      origin: "STAFF" as const,
      status: "CONFIRMED" as const,
      scheduled_at: parsed.data.scheduled_at,
      notes: parsed.data.notes ?? null,
      request_group_id: requestGroupId,
    })),
  );
  if (error) {
    // SLOT_TAKEN vem do trigger appointment_slot_guard (migração 0014).
    return {
      ok: false,
      error: error.message.includes("SLOT_TAKEN")
        ? "Esse horário acabou de ser preenchido. Escolha outro."
        : error.message,
    };
  }

  const addonError = await attachAddons(
    supabase,
    pet.tenant_id,
    ids[0]!,
    parsed.data.service_addon_ids ?? [],
  );
  if (addonError) return { ok: false, error: addonError };

  // O agendamento da loja já nasce CONFIRMED: entra direto na agenda do
  // profissional, que precisa saber sem depender de abrir o painel.
  await dispatchNotifications(pet.tenant_id);

  revalidatePath("/");
  revalidatePath("/atendimentos");
  revalidatePath("/solicitacoes");
  revalidatePath(`/pets/${pet.id}`);
  return { ok: true };
}

/** Staff confirma/recusa/avança o status de um atendimento (RLS garante o tenant). */
export async function updateAppointmentStatus(formData: FormData) {
  const parsed = appointmentStatusUpdate.safeParse({
    appointment_id: formData.get("appointment_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const tenant = await tenantIfCanMutate(supabase);
  if (!tenant) return;
  await supabase
    .from("appointment")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.appointment_id);

  // Confirmar ou recusar mexe na agenda do profissional escolhido.
  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/solicitacoes");
  revalidatePath("/atendimentos");
}

/**
 * Staff confirma/recusa vários serviços de uma solicitação de uma vez
 * (mesmo request_group_id). RLS garante o tenant.
 */
export async function updateAppointmentsStatus(formData: FormData) {
  const parsed = appointmentStatusBatchUpdate.safeParse({
    appointment_ids: formData.getAll("appointment_ids"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const tenant = await tenantIfCanMutate(supabase);
  if (!tenant) return;
  await supabase
    .from("appointment")
    .update({ status: parsed.data.status })
    .in("id", parsed.data.appointment_ids);

  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/solicitacoes");
  revalidatePath("/atendimentos");
}

/**
 * Cancela um agendamento já aceito, com motivo. Quando o pedido tem serviços
 * irmãos no mesmo horário (request_group_id), o diálogo manda todos os ids de
 * uma vez — a RPC cancel_appointment (0055) é quem sabe quem pode cancelar o
 * quê, e vale igual para o app do tutor.
 */
export async function cancelAppointment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = appointmentCancel.safeParse({
    appointment_ids: formData.getAll("appointment_ids"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  const tenant = await tenantIfCanMutate(supabase);
  if (!tenant) return { ok: false, error: "Seu acesso é somente leitura" };

  const { error } = await supabase.rpc("cancel_appointment", {
    p_appointment_ids: parsed.data.appointment_ids,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: error.message };

  // O tutor precisa saber que o horário dele caiu (0055), e o profissional
  // que a agenda abriu (0042).
  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/");
  revalidatePath("/atendimentos");
  revalidatePath("/agenda");
  for (const id of parsed.data.appointment_ids) {
    revalidatePath(`/atendimentos/${id}`);
  }
  return { ok: true };
}

/** Staff confirma uma reserva de produtos: marca como separada (PICKED). */
export async function confirmReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({
    reservation_id: formData.get("reservation_id"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const tenant = await tenantIfCanMutate(supabase);
  if (!tenant) return;
  await supabase
    .from("product_reservation")
    .update({ status: "PICKED" })
    .eq("id", parsed.data.reservation_id);

  // "Está separado, pode buscar" — o aviso mais útil para o tutor.
  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
}

/**
 * Staff conclui a retirada/pagamento de uma reserva já separada (PICKED → COMPLETED).
 * O trigger reservation_finance lança a receita automática (source RESERVATION).
 */
export async function completeReservation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const installments = Number.parseInt(
    String(formData.get("installments") ?? "1"),
    10,
  );
  const terminalId = String(formData.get("terminal_id") ?? "").trim();
  const parsed = paidReservationInput.safeParse({
    reservation_id: formData.get("reservation_id"),
    payment_method: formData.get("payment_method"),
    terminal_id: terminalId || undefined,
    installments:
      Number.isFinite(installments) && installments > 1
        ? installments
        : undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  if (!(await canMutate(supabase))) {
    return { ok: false, error: "Seu acesso é somente leitura" };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada" };

  const { error } = await supabase.rpc("complete_product_sale", {
    p_reservation_id: parsed.data.reservation_id,
    p_payment_method: parsed.data.payment_method,
    // A RPC aceita SQL NULL ("sem maquininha"); o gerador tipa uuid como string.
    p_terminal_id: (parsed.data.terminal_id ?? null) as unknown as string,
    p_installments: parsed.data.installments ?? 1,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
  revalidatePath("/financeiro");
  return { ok: true };
}

/**
 * Staff recusa uma reserva com um motivo (obrigatório): marca REJECTED,
 * grava o motivo e devolve o estoque — tudo na RPC com privilégio, que é
 * quem enxerga a variação de cada item. O motivo aparece para o tutor.
 */
export async function rejectReservation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = reservationReject.safeParse({
    reservation_id: formData.get("reservation_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  if (!(await canMutate(supabase))) {
    return { ok: false, error: "Seu acesso é somente leitura" };
  }
  const { error } = await supabase.rpc("staff_cancel_reservation", {
    p_reservation_id: parsed.data.reservation_id,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: error.message };

  // O motivo continua no banner dentro do app; isto alcança quem está fora.
  const tenant = await getActiveTenant(supabase);
  if (tenant) await dispatchNotifications(tenant.tenantId);

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
  return { ok: true };
}

export async function cancelReservationByStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = reservationReject.safeParse({
    reservation_id: formData.get("reservation_id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const supabase = await createClient();
  if (!(await canMutate(supabase))) {
    return { ok: false, error: "Seu acesso é somente leitura" };
  }
  const { error } = await supabase.rpc("cancel_product_reservation", {
    p_reservation_id: parsed.data.reservation_id,
    p_reason: parsed.data.reason,
    p_target_status: "CANCELLED",
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
  revalidatePath("/financeiro");
  return { ok: true };
}
