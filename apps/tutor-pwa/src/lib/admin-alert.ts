import "server-only";
import { after } from "next/server";
import { notifyPlatformAdmins } from "@mylivepet/notifications";
import { SUPPORT_CATEGORY_LABEL } from "@mylivepet/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Avisos para a equipe do Pet Live Pro (push do admin, 0081). Rodam com
// after(): saem depois da resposta, então quem está usando o app não espera o
// envio, e uma falha de push nunca derruba a ação que o originou.

const SURFACE_LABEL: Record<string, string> = {
  pet_photo: "foto do pet",
  product_photo: "foto de produto",
  appointment_photo: "foto do atendimento",
  tenant_logo: "logo do petshop",
  support_attachment: "anexo do suporte",
};

async function tenantName(tenantId: string | null) {
  if (!tenantId) return null;
  const { data } = await createAdminClient().from("tenant").select("name").eq("id", tenantId).maybeSingle();
  return data?.name ?? null;
}

/** Chamado novo. Denúncia contra petshop chega com título próprio. */
export function alertNewTicket(ticket: { id: string; number: number; category: string; origin: "TENANT" | "TUTOR"; tenantId: string }) {
  after(async () => {
    const shop = (await tenantName(ticket.tenantId)) ?? "petshop";
    const report = ticket.category === "PETSHOP_REPORT";
    await notifyPlatformAdmins(createAdminClient(), {
      audience: "support",
      title: report ? `Denúncia contra petshop · #${ticket.number}` : `Novo chamado #${ticket.number}`,
      body: report
        ? `Um tutor do ${shop} relatou um problema grave. Em sigilo.`
        : `${SUPPORT_CATEGORY_LABEL[ticket.category] ?? "Outro"} · ${ticket.origin === "TENANT" ? shop : `tutor do ${shop}`}`,
      href: `/suporte?t=${ticket.id}`,
      tag: `chamado-${ticket.id}`,
    });
  });
}

/** O cliente respondeu: vai para quem está com o chamado; sem responsável, para a equipe. */
export function alertTicketReply(ticketId: string, withFile: boolean) {
  after(async () => {
    const admin = createAdminClient();
    const { data: t } = await admin
      .from("support_ticket")
      .select("number, origin, assigned_admin, tenant_id")
      .eq("id", ticketId)
      .maybeSingle();
    if (!t) return;
    const shop = (await tenantName(t.tenant_id)) ?? "petshop";
    await notifyPlatformAdmins(admin, {
      audience: "support",
      userIds: t.assigned_admin ? [t.assigned_admin] : undefined,
      fallbackToAll: true,
      title: `Resposta no chamado #${t.number}`,
      body: `${t.origin === "TENANT" ? shop : `O tutor do ${shop}`} respondeu${withFile ? " com anexo" : ""}.`,
      href: `/suporte?t=${ticketId}`,
      tag: `chamado-${ticketId}`,
    });
  });
}

/** Upload barrado como tentativa de ataque (admin → Segurança). */
export function alertBlockedUpload(incident: { surface: string; tenantId: string | null; detected: string }) {
  after(async () => {
    const shop = await tenantName(incident.tenantId);
    await notifyPlatformAdmins(createAdminClient(), {
      audience: "security",
      title: "Upload bloqueado por segurança",
      body: `${incident.detected} · ${SURFACE_LABEL[incident.surface] ?? incident.surface}${shop ? ` · ${shop}` : ""}`.slice(0, 180),
      href: "/seguranca",
      tag: "seguranca-upload",
    });
  });
}
