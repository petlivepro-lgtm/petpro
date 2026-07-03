"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { collaboratorInput, type CollaboratorScheduleInput } from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Horários chegam serializados em JSON num input hidden (ver collaborator-dialog). */
function parseSchedules(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(typeof v === "string" ? v : "[]");
  } catch {
    return [];
  }
}

function parse(formData: FormData) {
  return collaboratorInput.safeParse({
    full_name: str(formData.get("full_name")),
    role_title: str(formData.get("role_title")),
    active: formData.get("active") === "on",
    schedules: parseSchedules(formData.get("schedules")),
  });
}

function scheduleRows(
  schedules: CollaboratorScheduleInput[],
  tenantId: string,
  collaboratorId: string,
) {
  return schedules.map((s) => ({
    tenant_id: tenantId,
    collaborator_id: collaboratorId,
    weekday: s.weekday,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
}

export async function createCollaborator(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { data, error } = await supabase
    .from("collaborator")
    .insert({
      tenant_id: tenant.tenantId,
      full_name: parsed.data.full_name,
      role_title: parsed.data.role_title ?? null,
      active: parsed.data.active ?? true,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar" };

  if (parsed.data.schedules.length > 0) {
    const { error: schedError } = await supabase
      .from("collaborator_schedule")
      .insert(scheduleRows(parsed.data.schedules, tenant.tenantId, data.id));
    if (schedError) return { ok: false, error: schedError.message };
  }

  revalidatePath("/colaboradores");
  return { ok: true };
}

export async function updateCollaborator(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Colaborador inválido" };

  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase
    .from("collaborator")
    .update({
      full_name: parsed.data.full_name,
      role_title: parsed.data.role_title ?? null,
      active: parsed.data.active ?? true,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Estratégia simples: recria as janelas de trabalho a cada edição.
  const { error: delError } = await supabase
    .from("collaborator_schedule")
    .delete()
    .eq("collaborator_id", id);
  if (delError) return { ok: false, error: delError.message };

  if (parsed.data.schedules.length > 0) {
    const { error: schedError } = await supabase
      .from("collaborator_schedule")
      .insert(scheduleRows(parsed.data.schedules, tenant.tenantId, id));
    if (schedError) return { ok: false, error: schedError.message };
  }

  revalidatePath("/colaboradores");
  return { ok: true };
}

export async function deleteCollaborator(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Colaborador inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("collaborator").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/colaboradores");
  return { ok: true };
}
