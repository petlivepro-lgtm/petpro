"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { serviceTypeInput } from "@mylivepet/types";

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

function parse(formData: FormData) {
  return serviceTypeInput.safeParse({
    name: str(formData.get("name")),
    description: str(formData.get("description")),
    price_cents: toCents(formData.get("price")),
    duration_min: toInt(formData.get("duration_min")),
    active: formData.get("active") === "on",
  });
}

export async function createServiceType(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase.from("service_type").insert({
    tenant_id: tenant.tenantId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    price_cents: parsed.data.price_cents,
    duration_min: parsed.data.duration_min,
    active: parsed.data.active ?? true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/servicos");
  return { ok: true };
}

export async function updateServiceType(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Serviço inválido" };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_type")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price_cents: parsed.data.price_cents,
      duration_min: parsed.data.duration_min,
      active: parsed.data.active ?? true,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/servicos");
  return { ok: true };
}

export async function deleteServiceType(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Serviço inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("service_type").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/servicos");
  return { ok: true };
}
