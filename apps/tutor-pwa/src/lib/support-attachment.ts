import "server-only";
import { randomUUID } from "node:crypto";
import { SUPPORT_ATTACHMENT_MAX_BYTES, sniffSupportFile } from "@mylivepet/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";

export type SupportFile = { bytes: Uint8Array; mime: string; ext: string; name: string };

/**
 * Lê o anexo do formulário e confere o tipo pelos BYTES, não pela extensão
 * nem pelo content-type do navegador (os dois são do cliente). SVG e HTML
 * ficam de fora: abririam script no domínio do Storage.
 */
export async function readSupportFile(entry: FormDataEntryValue | null): Promise<SupportFile | null | "invalid"> {
  if (!entry || typeof entry === "string" || entry.size === 0) return null;
  if (entry.size > SUPPORT_ATTACHMENT_MAX_BYTES) return "invalid";
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const kind = sniffSupportFile(bytes);
  if (!kind) return "invalid";
  const name = entry.name.replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 120) || `anexo.${kind.ext}`;
  return { bytes, mime: kind.mime, ext: kind.ext, name };
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
