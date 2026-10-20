"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TUTOR_APP_TOPICS } from "@mylivepet/types";
import type { SupportChatResult } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { readSupportFile, removeSupportFile, storeSupportFile, uploadSupportFile } from "@/lib/support-attachment";

export type TutorSupportResult = { ok: true; id: string; warning?: string } | { ok: false; error: string };

const SUBJECT: Record<string, string> = {
  ...Object.fromEntries(TUTOR_APP_TOPICS.map((t) => [t.value, t.label])),
  PETSHOP_REPORT: "Problema grave com o petshop",
};

function str(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v.trim() : "";
}

/** Chamado do tutor para a plataforma. A RPC confere que ele tem ficha no petshop. */
export async function openTutorTicket(formData: FormData): Promise<TutorSupportResult> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { ok: false, error: "Sua sessão terminou. Entre de novo." };

  const topic = str(formData.get("assunto"));
  if (!SUBJECT[topic]) return { ok: false, error: "Escolha o assunto de novo." };
  const file = await readSupportFile(formData.get("anexo"));
  if (file === "invalid") return { ok: false, error: "O anexo precisa ser imagem (PNG, JPG, WEBP) ou PDF de até 4 MB." };

  const h = await headers();
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_origin: "TUTOR",
    p_tenant: ctx.tenantId,
    p_category: topic,
    p_subject: SUBJECT[topic],
    p_body: str(formData.get("body")),
    p_context: { user_agent: (h.get("user-agent") ?? "").slice(0, 300), app: "tutor" },
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível enviar. Tente de novo." };
  const ticket = data as { id: string; number: number };

  let warning: string | undefined;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (file && user && !(await storeSupportFile(ticket.id, user.id, file))) {
    warning = "anexo";
  }
  revalidatePath("/ajuda");
  return { ok: true, id: ticket.id, warning };
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Resposta na conversa, com anexo opcional. O arquivo sobe antes (service
 * role, tipo conferido pelos bytes) e a RPC registra mensagem e anexo juntos;
 * se ela recusar, o arquivo sai do bucket.
 */
export async function replyTutorTicket(ticketId: string, formData: FormData): Promise<SupportChatResult> {
  if (!UUID.test(ticketId)) return { ok: false, error: "Chamado não encontrado." };
  const supabase = await createClient();
  const file = await readSupportFile(formData.get("anexo"));
  if (file === "invalid") return { ok: false, error: "O anexo precisa ser imagem (PNG, JPG, WEBP) ou PDF de até 4 MB." };

  let path: string | null = null;
  if (file) {
    // Só sobe arquivo para chamado que este tutor abriu (RLS).
    const { data: visible } = await supabase.from("support_ticket").select("id").eq("id", ticketId).maybeSingle();
    if (!visible) return { ok: false, error: "Chamado não encontrado." };
    path = await uploadSupportFile(ticketId, file);
    if (!path) return { ok: false, error: "O anexo não subiu. Tente de novo." };
  }

  const { error } = await supabase.rpc("reply_support_ticket", {
    p_ticket: ticketId,
    p_body: str(formData.get("body")),
    ...(file && path ? { p_file_path: path, p_file_name: file.name } : {}),
  });
  if (error) {
    if (path) await removeSupportFile(path);
    return { ok: false, error: error.message };
  }
  revalidatePath(`/ajuda/${ticketId}`);
  return { ok: true };
}

/** Encerramento pelo tutor, com avaliação opcional do atendimento. */
export async function closeTutorTicket(ticketId: string, rating: number | null, comment: string): Promise<SupportChatResult> {
  if (!UUID.test(ticketId)) return { ok: false, error: "Chamado não encontrado." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_support_ticket", {
    p_ticket: ticketId,
    ...(rating ? { p_rating: rating } : {}),
    p_comment: comment.slice(0, 1000),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ajuda");
  revalidatePath(`/ajuda/${ticketId}`);
  return { ok: true };
}

/** Leu a resposta da equipe: apaga o selo de "nova resposta" (menu e lista). */
export async function markTutorTicketRead(ticketId: string) {
  if (!UUID.test(ticketId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_support_read", { p_ticket: ticketId });
  revalidatePath(`/ajuda/${ticketId}`);
}
