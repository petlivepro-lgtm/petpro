import "server-only";
import { randomUUID } from "node:crypto";
import { SUPPORT_ATTACHMENT_MAX_BYTES, sniffSupportFile } from "@mylivepet/types";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Grava no bucket privado `support` (service role) e registra o anexo. */
export async function storeSupportFile(ticketId: string, userId: string, file: SupportFile) {
  const admin = createAdminClient();
  const path = `${ticketId}/${randomUUID()}.${file.ext}`;
  const { error } = await admin.storage
    .from("support")
    .upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (error) return false;
  const { error: rowError } = await admin.from("support_attachment").insert({
    ticket_id: ticketId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.mime,
    size_bytes: file.bytes.byteLength,
    uploaded_by: userId,
  });
  if (rowError) {
    await admin.storage.from("support").remove([path]);
    return false;
  }
  return true;
}
