"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
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

/**
 * Define o e-mail com que o colaborador entra no painel. A conta de auth NÃO
 * nasce aqui: ela é criada no primeiro acesso, quando ele escolhe a senha
 * (ver activateCollaboratorAccess em app/login/actions.ts).
 *
 * Só OWNER/MANAGER — mesmo recorte da policy membership_admin, já que o
 * primeiro acesso acaba criando uma membership.
 */
export async function setCollaboratorAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  const email = str(formData.get("access_email"))?.toLowerCase();
  if (!id) return { ok: false, error: "Colaborador inválido" };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Informe um e-mail válido" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };
  if (tenant.role !== "OWNER" && tenant.role !== "MANAGER") {
    return { ok: false, error: "Só o dono ou o gerente pode criar acessos" };
  }

  // E-mail que já tem conta no MyLivePet (um tutor, por exemplo) não pode
  // virar acesso de colaborador: a ativação criaria uma senha nova por cima
  // de uma conta que não é nossa para reivindicar.
  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.rpc("staff_access_target", {
    p_email: email,
  });
  if (targetError) {
    return { ok: false, error: "Não foi possível verificar o e-mail. Tente novamente." };
  }
  if ((target as { user_id?: string | null } | null)?.user_id) {
    return {
      ok: false,
      error: "Este e-mail já tem uma conta no MyLivePet. Use outro endereço.",
    };
  }

  const { error } = await supabase
    .from("collaborator")
    .update({ access_email: email })
    .eq("id", id);
  if (error) {
    // 23505 = colisão no índice único global de access_email
    if (error.code === "23505") {
      return { ok: false, error: "Este e-mail já está em uso por outro colaborador" };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/colaboradores");
  return { ok: true };
}

/**
 * Tira o acesso ao painel: remove a membership e limpa o vínculo. O middleware
 * derruba a sessão no request seguinte.
 *
 * A conta de auth continua existindo — apagá-la derrubaria a mesma pessoa em
 * outros vínculos (ela pode ser tutora de um petshop). Fica órfã e sem
 * membership, ou seja, sem acesso a nada.
 */
export async function revokeCollaboratorAccess(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Colaborador inválido" };

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };
  if (tenant.role !== "OWNER" && tenant.role !== "MANAGER") {
    return { ok: false, error: "Só o dono ou o gerente pode revogar acessos" };
  }

  const { data: collaborator, error: readError } = await supabase
    .from("collaborator")
    .select("profile_id")
    .eq("id", id)
    .single();
  if (readError || !collaborator) {
    return { ok: false, error: "Colaborador não encontrado" };
  }

  const admin = createAdminClient();
  if (collaborator.profile_id) {
    const { error: membershipError } = await admin
      .from("membership")
      .delete()
      .eq("tenant_id", tenant.tenantId)
      .eq("profile_id", collaborator.profile_id);
    if (membershipError) return { ok: false, error: membershipError.message };
  }

  const { error } = await admin
    .from("collaborator")
    .update({ profile_id: null, access_email: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

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
