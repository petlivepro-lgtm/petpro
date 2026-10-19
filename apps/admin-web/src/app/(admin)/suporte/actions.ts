"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import { notifyCustomer, PRIORITY_LABEL, STATUS_LABEL, type TicketPriority, type TicketStatus } from "@/lib/support";

const uuid = z.string().uuid();

const TEAM_NAME = "Equipe Pet Live Pro";

/** Nome do admin no chat: nunca o e-mail. Sem nome cadastrado, assina como a equipe. */
function teamLabel(p: { displayName: string; email: string }) {
  return p.displayName && !p.displayName.includes("@") ? p.displayName : TEAM_NAME;
}

type TicketCore = {
  id: string;
  number: number;
  origin: "TENANT" | "TUTOR";
  tenant_id: string;
  opened_by: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_admin: string | null;
  first_response_at: string | null;
};

async function loadTicket(id: string): Promise<TicketCore> {
  if (!uuid.safeParse(id).success) throw new ActionError("Chamado inválido.", "INVALID");
  const { data } = await serviceClient()
    .from("support_ticket")
    .select("id, number, origin, tenant_id, opened_by, status, priority, assigned_admin, first_response_at")
    .eq("id", id)
    .maybeSingle<TicketCore>();
  if (!data) throw new ActionError("Chamado não encontrado.", "INVALID");
  return data;
}

/** Resposta ao cliente ou nota interna (que o cliente nunca vê — RLS). */
export async function postMessage(ticketId: string, body: string, internal: boolean): Promise<ActionResult> {
  try {
    const p = await requireAdminAction();
    const text = z.string().trim().min(1).max(5000).safeParse(body);
    if (!text.success) throw new ActionError("Escreva a mensagem (até 5.000 caracteres).", "INVALID");
    const ticket = await loadTicket(ticketId);
    if (ticket.status === "CLOSED") throw new ActionError("Chamado encerrado.", "INVALID");

    const svc = serviceClient();
    const { error } = await svc.from("support_message").insert({
      ticket_id: ticket.id,
      author_kind: "ADMIN",
      author_id: p.userId,
      author_name: internal ? teamLabel(p) : TEAM_NAME,
      body: text.data,
      internal,
    });
    if (error) throw new Error(error.message);

    if (!internal) {
      await svc
        .from("support_ticket")
        .update({
          status: "WAITING_CUSTOMER",
          first_response_at: ticket.first_response_at ?? new Date().toISOString(),
          assigned_admin: ticket.assigned_admin ?? p.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);
      await notifyCustomer(ticket, "SUPPORT_REPLIED");
    } else if (ticket.status === "NEW") {
      await svc
        .from("support_ticket")
        .update({ status: "IN_PROGRESS", assigned_admin: ticket.assigned_admin ?? p.userId, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
    }

    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: internal ? "support.internal_note" : "support.replied",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      tenantId: ticket.tenant_id,
      afterData: { length: text.data.length },
    });
    revalidatePath("/suporte");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}

const updateSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assigned: z.union([z.string().uuid(), z.literal("")]).optional(),
});

/** Situação, prioridade e responsável. Toda mudança vira linha de sistema + auditoria. */
export async function updateTicket(ticketId: string, changes: z.input<typeof updateSchema>): Promise<ActionResult> {
  try {
    const p = await requireAdminAction();
    const parsed = updateSchema.safeParse(changes);
    if (!parsed.success) throw new ActionError("Alteração inválida.", "INVALID");
    const ticket = await loadTicket(ticketId);
    const c = parsed.data;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    // O cliente vê só a mudança de situação, sem quem fez. Prioridade e
    // responsável são assunto interno: viram nota que só a equipe enxerga.
    let publicNote: string | null = null;
    const notes: string[] = [];
    if (c.status && c.status !== ticket.status) {
      patch.status = c.status;
      patch.resolved_at = c.status === "RESOLVED" || c.status === "CLOSED" ? new Date().toISOString() : null;
      publicNote = `Situação do chamado: ${STATUS_LABEL[c.status]}`;
    }
    if (c.priority && c.priority !== ticket.priority) {
      patch.priority = c.priority;
      notes.push(`Prioridade: ${PRIORITY_LABEL[c.priority]}`);
    }
    if (c.assigned !== undefined && (c.assigned || null) !== ticket.assigned_admin) {
      if (c.assigned) {
        const { data: target } = await serviceClient()
          .from("platform_admin")
          .select("user_id")
          .eq("user_id", c.assigned)
          .eq("status", "active")
          .maybeSingle();
        if (!target) throw new ActionError("Responsável inválido.", "INVALID");
      }
      patch.assigned_admin = c.assigned || null;
      notes.push(c.assigned ? "Responsável alterado" : "Sem responsável");
    }
    if (!notes.length && !publicNote) return { ok: true };

    const svc = serviceClient();
    const { error } = await svc.from("support_ticket").update(patch).eq("id", ticket.id);
    if (error) throw new Error(error.message);
    const lines = [];
    if (publicNote) lines.push({ ticket_id: ticket.id, author_kind: "SYSTEM", body: publicNote, internal: false });
    if (notes.length) {
      lines.push({
        ticket_id: ticket.id,
        author_kind: "ADMIN",
        author_id: p.userId,
        author_name: teamLabel(p),
        body: notes.join(" · "),
        internal: true,
      });
    }
    await svc.from("support_message").insert(lines);
    if (patch.status === "RESOLVED") await notifyCustomer(ticket, "SUPPORT_RESOLVED");

    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "support.updated",
      resourceType: "support_ticket",
      resourceId: ticket.id,
      tenantId: ticket.tenant_id,
      beforeData: { status: ticket.status, priority: ticket.priority, assigned_admin: ticket.assigned_admin },
      afterData: patch,
    });
    revalidatePath("/suporte");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}

/** Link temporário (60 s) para abrir um anexo. Cada abertura fica registrada. */
export async function openAttachment(attachmentId: string): Promise<ActionResult<string>> {
  try {
    const p = await requireAdminAction();
    if (!uuid.safeParse(attachmentId).success) throw new ActionError("Anexo inválido.", "INVALID");
    const svc = serviceClient();
    const { data: att } = await svc
      .from("support_attachment")
      .select("id, ticket_id, storage_path")
      .eq("id", attachmentId)
      .maybeSingle<{ id: string; ticket_id: string; storage_path: string }>();
    if (!att) throw new ActionError("Anexo não encontrado.", "INVALID");
    const { data, error } = await svc.storage.from("support").createSignedUrl(att.storage_path, 60);
    if (error || !data) throw new ActionError("Não foi possível abrir o anexo.");
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "support.attachment_opened",
      resourceType: "support_attachment",
      resourceId: att.id,
    });
    return { ok: true, data: data.signedUrl };
  } catch (e) {
    return actionFailure(e);
  }
}
