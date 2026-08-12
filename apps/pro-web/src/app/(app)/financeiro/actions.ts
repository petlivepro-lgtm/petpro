"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import {
  canMutateAsRole,
  counterSaleInput,
  financeEntryInput,
  productRefundInput,
  serviceRefundInput,
  stockMovementInput,
  type Json,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function toCents(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toInt(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function json(v: FormDataEntryValue | null): unknown {
  if (typeof v !== "string") return undefined;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

async function managementContext() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { error: "Sem petshop vinculado" as const };
  if (!canMutateAsRole(tenant.role))
    return { error: "Seu acesso é somente leitura" as const };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada" as const };
  return { supabase, tenant, user };
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
    payment_method: str(formData.get("payment_method")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { supabase, tenant, user } = context;

  const { error } = await supabase.from("finance_entry").insert({
    tenant_id: tenant.tenantId,
    type: parsed.data.type,
    source: "MANUAL",
    description: parsed.data.description,
    category: parsed.data.category ?? null,
    amount_cents: parsed.data.amount_cents,
    occurred_on: parsed.data.occurred_on,
    payment_method: parsed.data.payment_method,
    created_by: user.id,
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

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase
    .from("finance_entry")
    .delete()
    .eq("id", id)
    .eq("source", "MANUAL");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/");
  return { ok: true };
}

export async function registerCounterSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = counterSaleInput.safeParse({
    tutor_id: str(formData.get("tutor_id")),
    payment_method: str(formData.get("payment_method")),
    idempotency_key: str(formData.get("idempotency_key")),
    items: json(formData.get("items")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { error } = await context.supabase.rpc("register_counter_sale", {
    p_tenant_id: context.tenant.tenantId,
    // A RPC aceita SQL NULL para "Consumidor final"; o gerador do Supabase
    // tipa parâmetros uuid de função como string mesmo quando NULL é válido.
    p_tutor_id: (parsed.data.tutor_id ?? null) as unknown as string,
    p_payment_method: parsed.data.payment_method,
    p_items: parsed.data.items as Json,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/produtos");
  revalidatePath("/");
  return { ok: true };
}

export async function refundProductSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = productRefundInput.safeParse({
    reservation_id: str(formData.get("reservation_id")),
    payment_method: str(formData.get("payment_method")),
    reason: str(formData.get("reason")),
    idempotency_key: str(formData.get("idempotency_key")),
    items: json(formData.get("items")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { error } = await context.supabase.rpc("refund_product_sale", {
    p_reservation_id: parsed.data.reservation_id,
    p_items: parsed.data.items as Json,
    p_reason: parsed.data.reason,
    p_payment_method: parsed.data.payment_method,
    p_idempotency_key: parsed.data.idempotency_key,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/produtos");
  revalidatePath("/");
  return { ok: true };
}

export async function refundService(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = serviceRefundInput.safeParse({
    appointment_id: str(formData.get("appointment_id")),
    payment_method: str(formData.get("payment_method")),
    reason: str(formData.get("reason")),
    idempotency_key: str(formData.get("idempotency_key")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { error } = await context.supabase.rpc("refund_service", {
    p_appointment_id: parsed.data.appointment_id,
    p_reason: parsed.data.reason,
    p_payment_method: parsed.data.payment_method,
    p_idempotency_key: parsed.data.idempotency_key,
  });
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
    variant_id: str(formData.get("variant_id")),
    type: str(formData.get("type")),
    quantity: toInt(formData.get("quantity")),
    note: str(formData.get("note")),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await managementContext();
  if ("error" in context) return { ok: false, error: context.error };
  const { error } = await context.supabase.rpc("register_stock_movement", {
    p_product_id: parsed.data.product_id,
    p_type: parsed.data.type,
    p_quantity: parsed.data.quantity,
    p_note: parsed.data.note ?? undefined,
    p_variant_id: parsed.data.variant_id ?? undefined,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/financeiro");
  revalidatePath("/produtos");
  revalidatePath("/");
  return { ok: true };
}
