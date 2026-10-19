"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { accountEmail } from "@/lib/data";
import { serviceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import { sendPasswordLink } from "@/lib/reset-link";

const uuid = z.string().uuid();
const reasonSchema = z.string().trim().min(10, "Explique o motivo em pelo menos 10 caracteres.").max(500);

export async function addTenantNote(tenantId: string, body: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction();
    const id = uuid.safeParse(tenantId);
    const text = z.string().trim().min(1).max(4000).safeParse(body);
    if (!id.success || !text.success) throw new ActionError("Escreva a nota (até 4.000 caracteres).", "INVALID");

    const { error } = await serviceClient().from("platform_admin_note").insert({
      tenant_id: id.data,
      author_id: p.userId,
      author_name: p.displayName,
      body: text.data,
    });
    if (error) throw new Error(error.message);
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "tenant.note_added",
      resourceType: "tenant",
      resourceId: id.data,
      tenantId: id.data,
      afterData: { length: text.data.length },
    });
    revalidatePath(`/petshops/${id.data}`);
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}

export async function sendOwnerResetLink(tenantId: string, reason: string): Promise<ActionResult<string>> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    const id = uuid.safeParse(tenantId);
    const why = reasonSchema.safeParse(reason);
    if (!id.success) throw new ActionError("Petshop inválido.", "INVALID");
    if (!why.success) throw new ActionError(why.error.issues[0]!.message, "INVALID");

    const email = await accountEmail({ tenant: id.data });
    if (!email) throw new ActionError("O dono deste petshop não tem e-mail de acesso.", "INVALID");

    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "tenant.owner_reset_link",
      resourceType: "tenant",
      resourceId: id.data,
      tenantId: id.data,
      reason: why.data,
    });
    const masked = await sendPasswordLink(email, "pro");
    return { ok: true, data: `Link enviado para ${masked}.` };
  } catch (e) {
    return actionFailure(e);
  }
}
