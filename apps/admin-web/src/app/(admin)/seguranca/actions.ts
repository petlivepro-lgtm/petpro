"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";

/**
 * A equipe olhou o upload bloqueado e decidiu o que fazer (conversar com o
 * petshop, bloquear a conta etc.). O registro fica; só sai da lista de
 * pendentes. Vai para a auditoria com a observação.
 */
export async function reviewUploadIncident(id: string, note: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    if (!z.string().uuid().safeParse(id).success) throw new ActionError("Registro inválido.", "INVALID");
    const text = note.trim().slice(0, 500) || null;
    const svc = serviceClient();
    const { data, error } = await svc
      .from("upload_incident")
      .update({ reviewed_at: new Date().toISOString(), reviewed_by: p.userId, review_note: text })
      .eq("id", id)
      .is("reviewed_at", null)
      .select("id, tenant_id")
      .maybeSingle<{ id: string; tenant_id: string | null }>();
    if (error) throw new Error(error.message);
    if (!data) throw new ActionError("Este registro já foi analisado.", "INVALID");
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "security.upload_incident_reviewed",
      resourceType: "upload_incident",
      resourceId: id,
      tenantId: data.tenant_id,
      reason: text,
    });
    revalidatePath("/seguranca");
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}
