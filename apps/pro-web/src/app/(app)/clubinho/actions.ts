"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import {
  CLUBINHO_SUBSCRIPTION_STATUSES,
  canMutateAsRole,
  clubinhoSubscriptionInput,
  clubinhoSubscriptionUpdateInput,
  type ClubinhoSubscriptionStatus,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

async function clubinhoContext() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { error: "Sem petshop vinculado" as const };
  if (!canMutateAsRole(tenant.role))
    return { error: "Seu acesso é somente leitura" as const };
  return { supabase, tenant };
}

function revalidateClubinho(petId?: string) {
  revalidatePath("/clubinho");
  revalidatePath("/tutores");
  revalidatePath("/financeiro");
  if (petId) revalidatePath(`/pets/${petId}`);
}

/** Campos de cobrança comuns à adesão e à edição. */
function paymentFields(formData: FormData) {
  const method = str(formData.get("payment_method"));
  const parsedInstallments = Number.parseInt(
    str(formData.get("installments")) ?? "1",
    10,
  );
  return {
    payment_method: method,
    terminal_id: str(formData.get("terminal_id")),
    installments:
      Number.isFinite(parsedInstallments) && parsedInstallments > 1
        ? parsedInstallments
        : 1,
  };
}

/** Regras que o banco também impõe, traduzidas antes da ida ao servidor. */
function chargeError(
  priceCents: number,
  method: string | undefined,
  installments: number,
): string | null {
  if (priceCents > 0 && !method) {
    return "Informe a forma de pagamento — é ela que lança a mensalidade no financeiro a cada renovação.";
  }
  if (installments > 1 && method !== "CREDIT_CARD") {
    return "Só o crédito pode ser parcelado";
  }
  return null;
}

/**
 * Coloca um pet no Clubinho.
 *
 * A vigência não é calculada aqui: o insert grava period_end = period_start e
 * o trigger de bootstrap (0047) abre o primeiro ciclo, ajusta a vigência pelo
 * ciclo do plano, cria o saldo e lança a mensalidade — tudo na mesma
 * transação.
 */
export async function createClubinhoSubscription(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const payment = paymentFields(formData);
  const parsed = clubinhoSubscriptionInput.safeParse({
    pet_id: str(formData.get("pet_id")),
    plan_id: str(formData.get("plan_id")),
    price_cents: str(formData.get("price")) ?? 0,
    started_on: str(formData.get("started_on")) ?? "",
    auto_renew: formData.get("auto_renew") === "on",
    payment_method: payment.payment_method,
    terminal_id: payment.terminal_id,
    installments: payment.installments,
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const problem = chargeError(
    parsed.data.price_cents,
    parsed.data.payment_method,
    parsed.data.installments,
  );
  if (problem) return { ok: false, error: problem };

  const context = await clubinhoContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { supabase, tenant } = context;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("clubinho_subscription").insert({
    // tenant_id e tutor_id são reescritos pelo trigger a partir do pet; vão
    // aqui só porque as colunas são NOT NULL.
    tenant_id: tenant.tenantId,
    tutor_id: tenant.tenantId,
    pet_id: parsed.data.pet_id,
    plan_id: parsed.data.plan_id,
    price_cents: parsed.data.price_cents,
    started_on: parsed.data.started_on,
    period_start: parsed.data.started_on,
    period_end: parsed.data.started_on,
    auto_renew: parsed.data.auto_renew,
    payment_method: parsed.data.payment_method ?? null,
    terminal_id: parsed.data.terminal_id ?? null,
    installments: parsed.data.installments,
    notes: parsed.data.notes ?? null,
    created_by: user?.id ?? null,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Este pet já tem uma assinatura aberta do Clubinho"
          : error.message,
    };
  }

  revalidateClubinho(parsed.data.pet_id);
  return { ok: true };
}

/**
 * Ajusta a assinatura. Não mexe no saldo do ciclo em andamento: mudar o valor
 * ou a forma de pagamento vale da próxima renovação em diante, porque o que já
 * foi cobrado está lançado no financeiro.
 */
export async function updateClubinhoSubscription(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const payment = paymentFields(formData);
  const parsed = clubinhoSubscriptionUpdateInput.safeParse({
    id: str(formData.get("id")),
    price_cents: str(formData.get("price")) ?? 0,
    auto_renew: formData.get("auto_renew") === "on",
    payment_method: payment.payment_method,
    terminal_id: payment.terminal_id,
    installments: payment.installments,
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const problem = chargeError(
    parsed.data.price_cents,
    parsed.data.payment_method,
    parsed.data.installments,
  );
  if (problem) return { ok: false, error: problem };

  const context = await clubinhoContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase
    .from("clubinho_subscription")
    .update({
      price_cents: parsed.data.price_cents,
      auto_renew: parsed.data.auto_renew,
      payment_method: parsed.data.payment_method ?? null,
      terminal_id: parsed.data.terminal_id ?? null,
      installments: parsed.data.installments,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.id)
    .eq("tenant_id", context.tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidateClubinho(str(formData.get("pet_id")));
  return { ok: true };
}

/**
 * Pausa, retoma ou cancela.
 *
 * Pausada, a assinatura para de renovar (a rotina só olha para as ativas) mas
 * segue ocupando a vaga única do pet — é a suspensão da viagem do tutor, não a
 * saída do Clubinho. Cancelada libera a vaga e apaga o selo do tutor quando
 * era o último pet dele no pacote.
 */
export async function setClubinhoSubscriptionStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  const status = str(formData.get("status")) as
    | ClubinhoSubscriptionStatus
    | undefined;
  if (!id || !status || !CLUBINHO_SUBSCRIPTION_STATUSES.includes(status)) {
    return { ok: false, error: "Assinatura inválida" };
  }

  const context = await clubinhoContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { supabase, tenant } = context;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Retomar não é um update qualquer: se a vigência venceu durante a pausa, a
  // RPC abre um ciclo começando hoje em vez de deixar a renovação recuperar
  // (e cobrar) mês a mês o período em que o pet não veio.
  if (status === "ACTIVE") {
    const { error: resumeError } = await supabase.rpc(
      "clubinho_resume_subscription",
      { p_id: id },
    );
    if (resumeError) return { ok: false, error: resumeError.message };
    revalidateClubinho(str(formData.get("pet_id")));
    return { ok: true };
  }

  const ending = status === "CANCELLED" || status === "EXPIRED";
  const { error } = await supabase
    .from("clubinho_subscription")
    .update({
      status,
      cancelled_at: ending ? new Date().toISOString() : null,
      cancelled_by: ending ? (user?.id ?? null) : null,
      cancellation_reason: ending
        ? (str(formData.get("cancellation_reason")) ?? null)
        : null,
    })
    .eq("id", id)
    .eq("tenant_id", tenant.tenantId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Este pet já tem outra assinatura aberta"
          : error.message,
    };
  }

  revalidateClubinho(str(formData.get("pet_id")));
  return { ok: true };
}
