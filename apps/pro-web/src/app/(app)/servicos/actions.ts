"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { serviceAddonInput, serviceTypeInput } from "@mylivepet/types";

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
    // Cor do serviço na agenda; vazio = a UI deriva do id.
    color_hex: str(formData.get("color_hex")),
    // Ids da biblioteca de etapas, na ordem enviada pelo dialog.
    step_ids: formData
      .getAll("step_ids")
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((s) => s !== ""),
  });
}

/**
 * Traduz os erros dos triggers de 0035 (id fora da biblioteca / etapa repetida),
 * que aparecem quando o dialog está com uma biblioteca desatualizada.
 */
function stepError(error: { code?: string; message: string }): string {
  if (error.code === "23503")
    return "Alguma etapa selecionada não existe mais — feche e reabra o serviço.";
  if (error.code === "23514") return "A mesma etapa foi escolhida duas vezes.";
  return error.message;
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
    color_hex: parsed.data.color_hex ?? null,
    step_ids: parsed.data.step_ids ?? [],
  });
  if (error) return { ok: false, error: stepError(error) };

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
      color_hex: parsed.data.color_hex ?? null,
      step_ids: parsed.data.step_ids ?? [],
    })
    .eq("id", id);
  if (error) return { ok: false, error: stepError(error) };

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

// ---------------------------------------------------------------------
// Serviços adicionais (0056): só nome e preço, escolhidos no agendamento
// junto do serviço principal.
// ---------------------------------------------------------------------

function parseAddon(formData: FormData) {
  return serviceAddonInput.safeParse({
    name: str(formData.get("name")),
    price_cents: toCents(formData.get("price")),
    active: formData.get("active") === "on",
  });
}

/** Nome repetido é barrado pelo índice service_addon_name_uq (0056). */
function addonError(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Já existe um adicional com esse nome.";
  return error.message;
}

export async function createServiceAddon(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseAddon(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase.from("service_addon").insert({
    tenant_id: tenant.tenantId,
    name: parsed.data.name,
    price_cents: parsed.data.price_cents,
    active: parsed.data.active ?? true,
  });
  if (error) return { ok: false, error: addonError(error) };

  revalidatePath("/servicos");
  return { ok: true };
}

export async function updateServiceAddon(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Adicional inválido" };

  const parsed = parseAddon(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_addon")
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.price_cents,
      active: parsed.data.active ?? true,
    })
    .eq("id", id);
  if (error) return { ok: false, error: addonError(error) };

  revalidatePath("/servicos");
  return { ok: true };
}

/**
 * Excluir só tira do catálogo: os atendimentos que já usaram o adicional guardam
 * nome e preço próprios (appointment_addon, 0056), então histórico e receitas
 * não mudam.
 */
export async function deleteServiceAddon(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Adicional inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("service_addon").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/servicos");
  return { ok: true };
}
