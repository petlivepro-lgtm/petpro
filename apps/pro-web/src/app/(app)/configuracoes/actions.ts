"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import {
  behaviorConfigSchema,
  canMutateAsRole,
  feedbackConfigSchema,
  serviceStepLibrarySchema,
  tenantSettingsInput,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

const BUCKET = "tenant-logos";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

type TenantSettingsJson = Record<string, unknown>;

/** Lê o jsonb `settings` atual do tenant (para merge — o update sobrescreve tudo). */
async function readSettings(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<TenantSettingsJson> {
  const { data } = await admin
    .from("tenant")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();
  return (data?.settings as TenantSettingsJson | null) ?? {};
}

/** Sobe a logo do petshop e retorna a URL pública. Cria o bucket sob demanda. */
async function uploadLogo(tenantId: string, file: File): Promise<string | null> {
  const admin = createAdminClient();
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    // bucket já existe — ignorável.
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${tenantId}/logo-${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function updateTenantSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = tenantSettingsInput.safeParse({
    name: str(formData.get("name")),
    phone: str(formData.get("phone")),
    email: str(formData.get("email")) ?? "",
    address: str(formData.get("address")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  // Mantém a logo atual a menos que um novo arquivo seja enviado.
  let logoPath = tenant.logoUrl;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const url = await uploadLogo(tenant.tenantId, file);
    if (!url) return { ok: false, error: "Falha ao enviar a logo" };
    logoPath = url;
  }

  // A tabela `tenant` não tem policy de UPDATE para o cliente (RLS) — a edição
  // é feita via service role, conforme o schema (0001_init.sql). A autorização
  // já está garantida: getActiveTenant confirma que o usuário é staff do tenant.
  const admin = createAdminClient();
  // Merge: o jsonb `settings` é sobrescrito por completo no update, então
  // preservamos as demais chaves (ex.: `feedback`, editado em outro form).
  const current = await readSettings(admin, tenant.tenantId);
  const { error } = await admin
    .from("tenant")
    .update({
      name: parsed.data.name,
      settings: {
        ...current,
        logo_path: logoPath,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email || null,
        address: parsed.data.address ?? null,
      },
    })
    .eq("id", tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/configuracoes");
  return { ok: true };
}

/** Salva o formulário de avaliação que o tutor verá (tenant.settings.feedback). */
export async function updateFeedbackConfig(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(typeof formData.get("config") === "string" ? (formData.get("config") as string) : "");
  } catch {
    return { ok: false, error: "Dados inválidos" };
  }
  const parsed = feedbackConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const admin = createAdminClient();
  // Merge para não apagar logo_path/phone/email/address salvos no outro form.
  const current = await readSettings(admin, tenant.tenantId);
  const { error } = await admin
    .from("tenant")
    .update({ settings: { ...current, feedback: parsed.data } })
    .eq("id", tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes");
  return { ok: true };
}

/**
 * Salva as categorias do boletim de comportamento (tenant.settings.behavior).
 * São as notas que a equipe dá ao pet ao finalizar cada atendimento.
 */
export async function updateBehaviorConfig(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(
      typeof formData.get("config") === "string" ? (formData.get("config") as string) : "",
    );
  } catch {
    return { ok: false, error: "Dados inválidos" };
  }
  const parsed = behaviorConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };
  if (!canMutateAsRole(tenant.role))
    return { ok: false, error: "Seu acesso é somente leitura" };

  const admin = createAdminClient();
  // Merge: `feedback` e os dados de contato vivem no mesmo jsonb.
  const current = await readSettings(admin, tenant.tenantId);
  const { error } = await admin
    .from("tenant")
    .update({ settings: { ...current, behavior: parsed.data } })
    .eq("id", tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/atendimentos");
  return { ok: true };
}

/**
 * Salva a biblioteca de etapas do atendimento (service_step_template, 0035).
 * Cada serviço escolhe as suas em service_type.step_ids, então renomear aqui
 * reflete em todos os serviços de uma vez.
 *
 * Diferente das outras configurações, esta não vive em tenant.settings: é
 * tabela com RLS `is_staff`, então grava com o client do usuário — sem service
 * role e sem o read-modify-write do jsonb.
 */
export async function updateStepLibrary(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(
      typeof formData.get("config") === "string" ? (formData.get("config") as string) : "",
    );
  } catch {
    return { ok: false, error: "Dados inválidos" };
  }
  const parsed = serviceStepLibrarySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };
  if (!canMutateAsRole(tenant.role))
    return { ok: false, error: "Seu acesso é somente leitura" };

  const steps = parsed.data.steps;
  const keep = new Set(steps.map((s) => s.id));

  // Só apaga o que esta tela carregou e o usuário tirou da lista — nunca "tudo
  // que não está na lista". Sem isso, um formulário aberto antes de a biblioteca
  // carregar apagaria o trabalho de todo mundo num clique, e o trigger
  // service_step_template_detach (0035) levaria junto o checklist dos serviços.
  const toDelete = parsed.data.known_ids.filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delError } = await supabase
      .from("service_step_template")
      .delete()
      .eq("tenant_id", tenant.tenantId)
      .in("id", toDelete);
    if (delError) return { ok: false, error: delError.message };
  }

  // Upsert por id: cria as novas e renomeia/reordena as existentes.
  if (steps.length > 0) {
    const { error } = await supabase.from("service_step_template").upsert(
      steps.map((s, position) => ({
        id: s.id,
        tenant_id: tenant.tenantId,
        label: s.label,
        position,
      })),
      { onConflict: "id" },
    );
    // Trocar dois rótulos entre si num único save viola o índice único no meio
    // da instrução; o caminho é salvar em dois passos.
    if (error)
      return {
        ok: false,
        error:
          error.code === "23505" ? "Já existe uma etapa com esse nome" : error.message,
      };
  }

  revalidatePath("/configuracoes");
  revalidatePath("/servicos"); // o dialog de serviço lista a biblioteca
  return { ok: true };
}
