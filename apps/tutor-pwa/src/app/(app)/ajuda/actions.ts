"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TUTOR_APP_TOPICS } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { readSupportFile, storeSupportFile } from "@/lib/support-attachment";

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

export async function replyTutorTicket(ticketId: string, body: string): Promise<TutorSupportResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", { p_ticket: ticketId, p_body: body });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ajuda/${ticketId}`);
  return { ok: true, id: ticketId };
}
