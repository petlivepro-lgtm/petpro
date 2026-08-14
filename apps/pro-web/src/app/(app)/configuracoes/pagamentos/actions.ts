"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import {
  canMutateAsRole,
  paymentFeeRulesInput,
  paymentTerminalInput,
  type Json,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

async function financeContext() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { error: "Sem petshop vinculado" as const };
  if (!canMutateAsRole(tenant.role))
    return { error: "Seu acesso é somente leitura" as const };
  return { supabase, tenant };
}

/**
 * Cria ou renomeia uma maquininha. Diferente das outras configurações, esta não
 * vive em tenant.settings: payment_terminal tem RLS própria (can_manage_finance),
 * então grava com o client do usuário — sem service role.
 */
export async function upsertPaymentTerminal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = paymentTerminalInput.safeParse({
    id: str(formData.get("id")),
    name: str(formData.get("name")) ?? "",
    active: formData.get("active") !== null,
    is_default: formData.get("is_default") !== null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await financeContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { supabase, tenant } = context;

  const { id, name, active, is_default } = parsed.data;
  const row = {
    tenant_id: tenant.tenantId,
    name,
    active: active ?? true,
    is_default: is_default ?? false,
  };

  const { error } = id
    ? await supabase
        .from("payment_terminal")
        .update(row)
        .eq("id", id)
        .eq("tenant_id", tenant.tenantId)
    : await supabase.from("payment_terminal").insert(row);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe uma maquininha com esse nome"
          : error.message,
    };
  }

  revalidatePath("/configuracoes/pagamentos");
  revalidatePath("/financeiro");
  return { ok: true };
}

/**
 * Exclui a maquininha. As receitas já lançadas não perdem a taxa: o valor e o
 * nome ficam congelados em finance_entry (fee_cents/terminal_name), só o vínculo
 * é desfeito. Ainda assim, desativar costuma ser melhor que excluir.
 */
export async function deletePaymentTerminal(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Maquininha inválida" };

  const context = await financeContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase
    .from("payment_terminal")
    .delete()
    .eq("id", id)
    .eq("tenant_id", context.tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/pagamentos");
  revalidatePath("/financeiro");
  return { ok: true };
}

/**
 * Salva a grade inteira de taxas de uma maquininha. A RPC troca tudo numa
 * transação e recusa faixas de parcelas sobrepostas — o zod repete a checagem
 * só para o erro sair legível antes da ida ao banco.
 */
export async function savePaymentFeeRules(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(
      typeof formData.get("config") === "string"
        ? (formData.get("config") as string)
        : "",
    );
  } catch {
    return { ok: false, error: "Dados inválidos" };
  }

  const parsed = paymentFeeRulesInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await financeContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase.rpc("save_payment_fee_rules", {
    p_terminal_id: parsed.data.terminal_id,
    p_rules: parsed.data.rules as unknown as Json,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/pagamentos");
  revalidatePath("/financeiro");
  return { ok: true };
}
