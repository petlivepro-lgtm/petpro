"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { financeEntryInput, stockMovementInput } from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Lê o valor em centavos (inteiro) já enviado pelo CurrencyInput. */
function toCents(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toInt(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function createFinanceEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = financeEntryInput.safeParse({
    type: str(formData.get("type")),
    description: str(formData.get("description")),
    category: str(formData.get("category")),
    amount_cents: toCents(formData.get("amount")),
    occurred_on: str(formData.get("occurred_on")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("finance_entry").insert({
    tenant_id: tenant.tenantId,
    type: parsed.data.type,
    source: "MANUAL",
    description: parsed.data.description,
    category: parsed.data.category ?? null,
    amount_cents: parsed.data.amount_cents,
    occurred_on: parsed.data.occurred_on,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteFinanceEntry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Lançamento inválido" };

  const supabase = await createClient();
  // Apenas lançamentos manuais podem ser excluídos; os automáticos são o
  // espelho de atendimentos/reservas concluídos.
  const { error } = await supabase
    .from("finance_entry")
    .delete()
    .eq("id", id)
    .eq("source", "MANUAL");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/");
  return { ok: true };
}

export async function registerStockMovement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = stockMovementInput.safeParse({
    product_id: str(formData.get("product_id")),
    type: str(formData.get("type")),
    quantity: toInt(formData.get("quantity")),
    note: str(formData.get("note")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_stock_movement", {
    p_product_id: parsed.data.product_id,
    p_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/produtos");
  revalidatePath("/");
  return { ok: true };
}
