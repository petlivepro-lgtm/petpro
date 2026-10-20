import "server-only";
import { randomUUID } from "node:crypto";
import { SUPPORT_ATTACHMENT_MAX_BYTES } from "@mylivepet/types";
import type { CleanFile } from "@mylivepet/uploads";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { guardUpload } from "@/lib/upload-guard";

export type SupportFile = CleanFile;

/**
 * Anexo do suporte pelo guard de upload: tipo pelos bytes, imagem regravada
 * (o print continua legível até 2400 px) e PDF sem conteúdo ativo. Tentativa
 * de ataque vai para admin → Segurança.
 */
export function readSupportFile(entry: FormDataEntryValue | null, tenantId: string | null) {
  return guardUpload(entry, "support_attachment", tenantId, {
    accept: "image-or-pdf",
    maxBytes: SUPPORT_ATTACHMENT_MAX_BYTES,
    maxSide: 2400,
  });
}

/**
 * Sobe o arquivo no bucket privado `support` (service role). Quem registra o
 * anexo é a RPC reply_support_ticket, na mesma transação da mensagem; se ela
 * recusar, o chamador apaga o arquivo com removeSupportFile.
 */
export async function uploadSupportFile(ticketId: string, file: SupportFile): Promise<string | null> {
  const path = `${ticketId}/${randomUUID()}.${file.ext}`;
  const { error } = await createAdminClient()
    .storage.from("support")
    .upload(path, file.bytes, { contentType: file.mime, upsert: false });
  return error ? null : path;
}

export async function removeSupportFile(path: string) {
  await createAdminClient().storage.from("support").remove([path]);
}

/** Anexo da abertura: grava e prende à primeira mensagem do chamado. */
export async function storeSupportFile(ticketId: string, userId: string, file: SupportFile) {
  const admin = createAdminClient();
  const path = await uploadSupportFile(ticketId, file);
  if (!path) return false;
  const { data: first } = await admin
    .from("support_message")
    .select("id")
    .eq("ticket_id", ticketId)
    .eq("author_kind", "CUSTOMER")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const { error: rowError } = await admin.from("support_attachment").insert({
    ticket_id: ticketId,
    message_id: first?.id ?? null,
    storage_path: path,
    file_name: file.name,
    mime_type: file.mime,
    size_bytes: file.bytes.byteLength,
    uploaded_by: userId,
  });
  if (rowError) {
    await removeSupportFile(path);
    return false;
  }
  return true;
}

/**
 * Arquivo de um anexo que a pessoa logada enxerga. A RLS decide no client
 * dela (chamado próprio, nunca de nota interna); só depois o service role
 * busca o caminho no bucket, que o cliente nunca vê.
 */
export async function readSupportAttachment(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data: att } = await supabase
    .from("support_attachment")
    .select("id, file_name, mime_type")
    .eq("id", id)
    .maybeSingle();
  if (!att) return null;
  const admin = createAdminClient();
  const { data: row } = await admin.from("support_attachment").select("storage_path").eq("id", att.id).maybeSingle();
  if (!row) return null;
  const { data: blob } = await admin.storage.from("support").download(row.storage_path);
  if (!blob) return null;
  return { blob, mime: att.mime_type, name: att.file_name };
}
