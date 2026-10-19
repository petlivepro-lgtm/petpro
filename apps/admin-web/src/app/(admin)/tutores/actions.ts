"use server";

import { z } from "zod";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { accountEmail, revealTutorField } from "@/lib/data";
import { writeAudit } from "@/lib/audit";
import { sendPasswordLink } from "@/lib/reset-link";

const FIELD_LABEL = { phone: "telefone", cpf: "CPF", email: "e-mail" } as const;
type Field = keyof typeof FIELD_LABEL;

const reasonSchema = z.string().trim().min(10, "Explique o motivo em pelo menos 10 caracteres.").max(500);

/**
 * Revela um dado pessoal inteiro. A auditoria é gravada ANTES da leitura:
 * se o registro falhar, o dado não sai.
 */
export async function revealField(tutorId: string, field: Field, reason: string): Promise<ActionResult<string>> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    if (!z.string().uuid().safeParse(tutorId).success || !(field in FIELD_LABEL)) {
      throw new ActionError("Pedido inválido.", "INVALID");
    }
    const why = reasonSchema.safeParse(reason);
    if (!why.success) throw new ActionError(why.error.issues[0]!.message, "INVALID");

    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: `tutor.revealed_${field}`,
      resourceType: "tutor",
      resourceId: tutorId,
      reason: why.data,
    });
    const value = await revealTutorField(tutorId, field);
    return { ok: true, data: value ?? "(vazio)" };
  } catch (e) {
    return actionFailure(e);
  }
}

export async function sendTutorResetLink(tutorId: string, reason: string): Promise<ActionResult<string>> {
  try {
    const p = await requireAdminAction({ minRole: "admin" });
    if (!z.string().uuid().safeParse(tutorId).success) throw new ActionError("Tutor inválido.", "INVALID");
    const why = reasonSchema.safeParse(reason);
    if (!why.success) throw new ActionError(why.error.issues[0]!.message, "INVALID");

    const email = await accountEmail({ tutor: tutorId });
    // Conta criada por telefone usa e-mail técnico (tutor-pwa/login/phone-account.ts),
    // que não recebe nada.
    if (!email || email.toLowerCase().endsWith("@telefone.mylivepet.app")) {
      throw new ActionError("Este tutor entra pelo telefone. Peça ao petshop para redefinir o acesso.", "INVALID");
    }
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "tutor.reset_link",
      resourceType: "tutor",
      resourceId: tutorId,
      reason: why.data,
    });
    const masked = await sendPasswordLink(email, "tutor");
    return { ok: true, data: `Link enviado para ${masked}.` };
  } catch (e) {
    return actionFailure(e);
  }
}
