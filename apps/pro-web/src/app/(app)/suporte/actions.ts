"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { TENANT_SUPPORT_CATEGORIES } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { readSupportFile, storeSupportFile } from "@/lib/support-attachment";

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
  const file = await readSupportFile(formData.get("anexo"));
  if (file === "invalid") return { ok: false, error: "O anexo precisa ser imagem (PNG, JPG, WEBP) ou PDF de até 4 MB." };

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

export async function replySupportTicket(ticketId: string, body: string): Promise<SupportResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_support_ticket", { p_ticket: ticketId, p_body: body });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/suporte/${ticketId}`);
  return { ok: true, id: ticketId };
}
