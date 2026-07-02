import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "pet-photos";

/** Sobe a foto do pet e retorna a URL pública. Cria o bucket sob demanda. */
export async function uploadPetPhoto(tenantId: string, file: File): Promise<string | null> {
  const admin = createAdminClient();
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    // bucket já existe — ignorável.
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${tenantId}/pet-${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return null;
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
