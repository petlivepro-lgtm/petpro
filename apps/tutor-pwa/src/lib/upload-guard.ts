import "server-only";
import { randomUUID } from "node:crypto";
import { checkUpload, type CleanFile, type UploadPolicy, type UploadThreat } from "@mylivepet/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const APP = "tutor";

/** Onde o arquivo foi enviado — aparece no alerta do admin. */
export type UploadSurface = "pet_photo" | "product_photo" | "appointment_photo" | "tenant_logo" | "support_attachment";

export type GuardResult = { ok: true; files: CleanFile[] } | { ok: false; error: string };

/**
 * Confere cada arquivo (@mylivepet/uploads) ANTES de qualquer gravação: um
 * arquivo recusado não pode deixar meio cadastro salvo. Tentativa de ataque
 * vira registro para a equipe; a pessoa só vê a mensagem de recusa.
 */
export async function guardUploads(
  files: File[],
  surface: UploadSurface,
  tenantId: string | null,
  policy: UploadPolicy = { accept: "image" },
): Promise<GuardResult> {
  const clean: CleanFile[] = [];
  for (const file of files) {
    const res = await checkUpload(file, policy);
    if (!res.ok) {
      if (res.threat) await reportThreat(res.threat, surface, tenantId);
      return { ok: false, error: files.length > 1 ? `${file.name}: ${res.error}` : res.error };
    }
    clean.push(res.file);
  }
  return { ok: true, files: clean };
}

/** Um arquivo opcional de um campo: null quando não veio nada. */
export async function guardUpload(
  entry: FormDataEntryValue | null,
  surface: UploadSurface,
  tenantId: string | null,
  policy?: UploadPolicy,
): Promise<{ ok: true; file: CleanFile | null } | { ok: false; error: string }> {
  if (!entry || typeof entry === "string" || entry.size === 0) return { ok: true, file: null };
  const res = await guardUploads([entry], surface, tenantId, policy);
  return res.ok ? { ok: true, file: res.files[0] ?? null } : res;
}

async function reportThreat(t: UploadThreat, surface: UploadSurface, tenantId: string | null) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await createAdminClient()
      .from("upload_incident")
      .insert({
        app: APP,
        surface,
        tenant_id: tenantId,
        profile_id: user?.id ?? null,
        actor_name: ((user?.user_metadata?.full_name as string | undefined) ?? "").trim().slice(0, 120) || null,
        actor_email: user?.email ?? null,
        file_name: t.fileName,
        declared_type: t.declaredType,
        size_bytes: t.size,
        reason: t.reason,
        detected: t.detected.slice(0, 300),
        sha256: t.sha256,
      });
    if (error) console.error("[upload-guard] incidente não gravado:", error.message);
  } catch (e) {
    // O registro nunca derruba a recusa: o arquivo já foi barrado.
    console.error("[upload-guard] incidente não gravado:", e);
  }
}

/** Grava a imagem já conferida num bucket público e devolve a URL. */
export async function storePublicImage(bucket: string, folder: string, file: CleanFile): Promise<string | null> {
  const admin = createAdminClient();
  const path = `${folder}/${randomUUID()}.${file.ext}`;
  const { error } = await admin.storage.from(bucket).upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (error) return null;
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
