"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import {
  appointmentStatusUpdate,
  appointmentStatusBatchUpdate,
  canMutateAsRole,
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

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Staff confirma/recusa/avança o status de um atendimento (RLS garante o tenant). */
export async function updateAppointmentStatus(formData: FormData) {
  const parsed = appointmentStatusUpdate.safeParse({
    appointment_id: formData.get("appointment_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  if (!(await canMutate(supabase))) return;
  await supabase
    .from("appointment")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.appointment_id);

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
  if (!(await canMutate(supabase))) return;
  await supabase
    .from("appointment")
    .update({ status: parsed.data.status })
    .in("id", parsed.data.appointment_ids);

  revalidatePath("/solicitacoes");
  revalidatePath("/atendimentos");
}

/** Staff confirma uma reserva de produtos: marca como separada (PICKED). */
export async function confirmReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({
    reservation_id: formData.get("reservation_id"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  if (!(await canMutate(supabase))) return;
  await supabase
    .from("product_reservation")
    .update({ status: "PICKED" })
    .eq("id", parsed.data.reservation_id);

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
