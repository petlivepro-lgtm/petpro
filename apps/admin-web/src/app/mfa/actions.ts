"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { privateHash, readJwtClaims, requestMeta } from "@/lib/security";
import { isLocked, LOCK_WINDOW_MIN, recordAttempt } from "@/lib/rate-limit";
import { markStepUp, revokeSession, startAdminSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

const codeSchema = z.string().regex(/^\d{6}$/, "O código tem 6 dígitos.");

export type Enrollment = { factorId: string; qrCode: string; secret: string };

/** Gera o QR Code do app autenticador (primeiro acesso). */
export async function startEnrollment(): Promise<ActionResult<Enrollment>> {
  try {
    const p = await requireAdminAction({ allowPending: true, requireMfa: false });
    const supabase = await createSessionClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    if (factors?.totp.length) {
      throw new ActionError("O app autenticador já está configurado. Digite o código.", "INVALID");
    }
    // Restos de tentativas anteriores (QR gerado e nunca confirmado).
    for (const f of factors?.all ?? []) {
      if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Admin ${new Date().toISOString().slice(0, 10)}`,
      issuer: "Pet Live Pro Admin",
    });
    if (error || !data || data.type !== "totp") {
      throw new ActionError("Não foi possível gerar o QR Code. Tente de novo.");
    }
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.mfa_enroll_started",
      resourceType: "admin_member",
      resourceId: p.userId,
    });
    return {
      ok: true,
      data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret },
    };
  } catch (e) {
    return actionFailure(e);
  }
}

/**
 * Confere o código e sobe a sessão para aal2. Na ativação de convite, é aqui
 * que o acesso passa a "ativo" — só depois da senha nova E do MFA.
 */
export async function verifyMfa(factorId: string, rawCode: string): Promise<ActionResult> {
  let ok = false;
  try {
    const p = await requireAdminAction({ allowPending: true, requireMfa: false });
    if (p.status === "invited" && !p.passwordSet) {
      throw new ActionError("Crie a senha nova antes do código.", "INVALID");
    }
    const code = codeSchema.safeParse(rawCode.trim());
    if (!code.success) throw new ActionError("O código tem 6 dígitos.", "INVALID");

    const { ipHash } = await requestMeta();
    const identity = privateHash(p.userId);
    if (await isLocked("mfa", identity, ipHash)) {
      await revokeSession(p.sessionId, "mfa-bloqueado");
      const supabase = await createSessionClient();
      await supabase.auth.signOut({ scope: "local" });
      throw new ActionError(
        `Muitos códigos errados. Entre de novo daqui a ${LOCK_WINDOW_MIN} minutos.`,
        "AUTH",
      );
    }

    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.data,
    });
    if (error || !data) {
      await recordAttempt("mfa", identity, ipHash, false);
      throw new ActionError("Código incorreto. Digite o que está aparecendo agora no app.", "INVALID");
    }
    await recordAttempt("mfa", identity, ipHash, true);

    // O Supabase mantém o mesmo session_id ao subir para aal2; se um dia
    // mudar, a sessão nova herda o registro em vez de cair no próximo request.
    const newSession = readJwtClaims(data.access_token).session_id;
    if (newSession && newSession !== p.sessionId) {
      await startAdminSession(data.access_token, p.userId);
      await revokeSession(p.sessionId, "substituida-mfa");
    }
    await markStepUp(newSession ?? p.sessionId);

    if (p.status === "invited") {
      const svc = serviceClient();
      const now = new Date().toISOString();
      await svc
        .from("platform_admin")
        .update({ status: "active", activated_at: now })
        .eq("user_id", p.userId)
        .eq("status", "invited");
      await svc
        .from("platform_admin_invite")
        .update({ used_at: now })
        .eq("claimed_by", p.userId)
        .is("used_at", null);
      await writeAudit({
        actorId: p.userId,
        actorEmail: p.email,
        action: "admin.activated",
        resourceType: "admin_member",
        resourceId: p.userId,
      });
    } else {
      await writeAudit({
        actorId: p.userId,
        actorEmail: p.email,
        action: "admin.mfa_verified",
        resourceType: "admin_session",
        resourceId: newSession ?? p.sessionId,
      });
    }
    ok = true;
  } catch (e) {
    return actionFailure(e);
  }
  if (ok) redirect("/");
  return { ok: true };
}

/**
 * Reconfirmação do código para ações de governança (convidar, suspender,
 * revogar). Vale por 10 minutos nesta sessão.
 */
export async function stepUp(rawCode: string): Promise<ActionResult> {
  try {
    const p = await requireAdminAction();
    const code = codeSchema.safeParse(rawCode.trim());
    if (!code.success) throw new ActionError("O código tem 6 dígitos.", "INVALID");

    const { ipHash } = await requestMeta();
    const identity = privateHash(p.userId);
    if (await isLocked("mfa", identity, ipHash)) {
      throw new ActionError(`Muitos códigos errados. Aguarde ${LOCK_WINDOW_MIN} minutos.`, "INVALID");
    }

    const supabase = await createSessionClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp[0];
    if (!factor) throw new ActionError("App autenticador não encontrado.", "AUTH");

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
    if (error) {
      await recordAttempt("mfa", identity, ipHash, false);
      throw new ActionError("Código incorreto.", "INVALID");
    }
    await recordAttempt("mfa", identity, ipHash, true);
    await markStepUp(p.sessionId);
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.step_up",
      resourceType: "admin_session",
      resourceId: p.sessionId,
    });
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}
