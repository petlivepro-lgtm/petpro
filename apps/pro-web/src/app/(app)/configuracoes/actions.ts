"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { feedbackConfigSchema, tenantSettingsInput } from "@mylivepet/types";

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
