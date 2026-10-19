"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFailure, ActionError, requireAdminAction, requireStepUp, type ActionResult } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { createInvite } from "@/lib/invites";
import { assignableRoles, isAdminRole } from "@/lib/roles";
import { revokeAllSessions } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

const reasonSchema = z.string().trim().min(10, "Explique o motivo em pelo menos 10 caracteres.").max(500);

export async function inviteAdmin(input: { email: string; role: string; reason: string }): Promise<ActionResult<string>> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    requireStepUp(p);
    const email = z.string().trim().toLowerCase().email().max(254).safeParse(input.email);
    if (!email.success) throw new ActionError("E-mail inválido.", "INVALID");
    if (!isAdminRole(input.role) || !assignableRoles(p.role).includes(input.role)) {
      throw new ActionError("Você só pode convidar papéis abaixo do seu.", "FORBIDDEN");
    }
    const why = reasonSchema.safeParse(input.reason);
    if (!why.success) throw new ActionError(why.error.issues[0]!.message, "INVALID");

    const invite = await createInvite({ email: email.data, role: input.role, invitedBy: p.userId, reason: why.data });
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.invited",
      resourceType: "admin_invite",
      resourceId: invite.inviteId,
      reason: why.data,
      afterData: { email: email.data, role: input.role },
    });
    revalidatePath("/admins");
    return { ok: true, data: `Convite enviado para ${email.data}. O link vale 24 horas.` };
  } catch (e) {
    return actionFailure(e);
  }
}

type Target = { user_id: string; email: string; role: string; status: string };

async function loadTarget(userId: string): Promise<Target> {
  if (!z.string().uuid().safeParse(userId).success) throw new ActionError("Administrador inválido.", "INVALID");
  const { data } = await serviceClient()
    .from("platform_admin")
    .select("user_id, email, role, status")
    .eq("user_id", userId)
    .maybeSingle<Target>();
  if (!data) throw new ActionError("Administrador não encontrado.", "INVALID");
  return data;
}

/** Suspender derruba todas as sessões na hora; reativar não devolve sessão nenhuma. */
export async function setAdminStatus(userId: string, status: "active" | "suspended", reason: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction({ minRole: "superadmin" });
    requireStepUp(p);
    if (userId === p.userId) throw new ActionError("Você não pode mudar o próprio acesso.", "FORBIDDEN");
    const why = reasonSchema.safeParse(reason);
    if (!why.success) throw new ActionError(why.error.issues[0]!.message, "INVALID");
    const target = await loadTarget(userId);
    if (status === "active" && target.status !== "suspended") throw new ActionError("Só um acesso suspenso pode ser reativado.", "INVALID");

    const { error } = await serviceClient()
      .from("platform_admin")
      .update(
        status === "suspended"
          ? { status, suspended_at: new Date().toISOString(), suspension_reason: why.data }
          : { status, suspended_at: null, suspension_reason: null },
      )
      .eq("user_id", userId);
    if (error) {
      // A trava do banco (último superadmin) chega aqui como erro.
      throw new ActionError(error.message.includes("último superadmin") ? "Não é possível suspender o último superadmin ativo." : "Não foi possível alterar o acesso.");
    }
    if (status === "suspended") await revokeAllSessions(userId, "suspenso");

    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: status === "suspended" ? "admin.suspended" : "admin.reactivated",
      resourceType: "admin_member",
      resourceId: userId,
      reason: why.data,
      beforeData: { status: target.status },
      afterData: { status },
    });
    revalidatePath("/admins");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}

export async function revokeAdminSessions(userId: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction({ minRole: "superadmin" });
    requireStepUp(p);
    const target = await loadTarget(userId);
    await revokeAllSessions(target.user_id, "revogada-pelo-painel", target.user_id === p.userId ? p.sessionId : undefined);
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.sessions_revoked",
      resourceType: "admin_member",
      resourceId: target.user_id,
    });
    revalidatePath("/admins");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}

export async function cancelInvite(inviteId: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    requireStepUp(p);
    if (!z.string().uuid().safeParse(inviteId).success) throw new ActionError("Convite inválido.", "INVALID");
    const { data } = await serviceClient()
      .from("platform_admin_invite")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", inviteId)
      .is("used_at", null)
      .is("revoked_at", null)
      .select("email, role")
      .maybeSingle<{ email: string; role: string }>();
    if (!data) throw new ActionError("Convite já usado ou cancelado.", "INVALID");
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.invite_cancelled",
      resourceType: "admin_invite",
      resourceId: inviteId,
      beforeData: data,
    });
    revalidatePath("/admins");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}
