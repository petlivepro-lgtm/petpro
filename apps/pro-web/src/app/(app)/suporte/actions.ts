"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_SUPPORT_CATEGORIES } from "@mylivepet/types";
import type { SupportChatResult } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { readSupportFile, removeSupportFile, storeSupportFile, uploadSupportFile, type SupportFile } from "@/lib/support-attachment";

export type SupportResult = { ok: true; id: string; warning?: string } | { ok: false; error: string };

function str(v: FormDataEntryValue | null) {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Abre chamado do petshop para a plataforma. A RPC confere de novo que quem
 * chama é dono ou gerente deste petshop — a checagem daqui é só para a
 * mensagem sair amigável.
 */
export async function openSupportTicket(formData: FormData): Promise<SupportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão terminou. Entre de novo." };
  const tenant = await getActiveTenant(supabase, user.id);
  if (!tenant || (tenant.role !== "OWNER" && tenant.role !== "MANAGER")) {
    return { ok: false, error: "Só o dono ou o gerente do petshop abre chamados." };
  }

  const category = str(formData.get("category"));
  if (!TENANT_SUPPORT_CATEGORIES.some((c) => c.value === category)) {
    return { ok: false, error: "Escolha sobre o que é o chamado." };
  }
  const attachment = await readSupportFile(formData.get("anexo"), tenant.tenantId);
  if (!attachment.ok) return { ok: false, error: attachment.error };
  const file = attachment.file;

  const h = await headers();
  const { data, error } = await supabase.rpc("open_support_ticket", {
    p_origin: "TENANT",
    p_tenant: tenant.tenantId,
    p_category: category,
    p_subject: str(formData.get("subject")),
    p_body: str(formData.get("body")),
    p_context: {
      page: str(formData.get("page")).slice(0, 200),
      user_agent: (h.get("user-agent") ?? "").slice(0, 300),
      app: "painel",
    },
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível abrir o chamado." };
  const ticket = data as { id: string; number: number };

  let warning: string | undefined;
  if (file && !(await storeSupportFile(ticket.id, user.id, file))) {
    warning = "O chamado foi aberto, mas o anexo não subiu. Descreva o problema na conversa.";
  }
  revalidatePath("/suporte");
  return { ok: true, id: ticket.id, warning };
}

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Resposta na conversa, com anexo opcional. O arquivo sobe antes (service
 * role, tipo conferido pelos bytes) e a RPC registra mensagem e anexo juntos;
 * se ela recusar, o arquivo sai do bucket.
 */
export async function replySupportTicket(ticketId: string, formData: FormData): Promise<SupportChatResult> {
  if (!UUID.test(ticketId)) return { ok: false, error: "Chamado não encontrado." };
  const supabase = await createClient();
  const entry = formData.get("anexo");
  let file: SupportFile | null = null;
  let path: string | null = null;
  if (entry && typeof entry !== "string" && entry.size > 0) {
    // Só sobe arquivo para chamado que esta pessoa enxerga (RLS).
    const { data: visible } = await supabase.from("support_ticket").select("id, tenant_id").eq("id", ticketId).maybeSingle();
    if (!visible) return { ok: false, error: "Chamado não encontrado." };
    const attachment = await readSupportFile(entry, visible.tenant_id);
    if (!attachment.ok) return { ok: false, error: attachment.error };
    file = attachment.file;
  }
  if (file) {
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
  revalidatePath(`/suporte/${ticketId}`);
  return { ok: true };
}

/** Encerramento pelo petshop, com avaliação opcional do atendimento. */
export async function closeSupportTicket(ticketId: string, rating: number | null, comment: string): Promise<SupportChatResult> {
  if (!UUID.test(ticketId)) return { ok: false, error: "Chamado não encontrado." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_support_ticket", {
    p_ticket: ticketId,
    ...(rating ? { p_rating: rating } : {}),
    p_comment: comment.slice(0, 1000),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/suporte");
  revalidatePath(`/suporte/${ticketId}`);
  return { ok: true };
}

/** Leu a resposta da equipe: apaga o selo de "nova resposta" (menu e lista). */
export async function markSupportRead(ticketId: string) {
  if (!UUID.test(ticketId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_support_read", { p_ticket: ticketId });
  revalidatePath(`/suporte/${ticketId}`);
}
