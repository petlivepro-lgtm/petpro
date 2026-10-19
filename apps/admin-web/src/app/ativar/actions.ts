"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { anonClient, serviceClient } from "@/lib/supabase/service";
import { actionFailure, ActionError, requireAdminAction, type ActionResult } from "@/lib/auth";
import { requestMeta, sha256Hex } from "@/lib/security";
import { isLocked, recordAttempt } from "@/lib/rate-limit";
import { revokeAllSessions, startAdminSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";
import { failedPasswordRules } from "@/lib/password-policy";

const claimSchema = z.object({
  convite: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
  accessToken: z.string().min(20).max(4000),
  refreshToken: z.string().min(1).max(500),
});

type InviteRow = {
  id: string;
  email: string;
  role: string;
  invited_by: string | null;
  expires_at: string;
  claimed_by: string | null;
  used_at: string | null;
  revoked_at: string | null;
};

const INVALID = "Este convite expirou, já foi usado ou não é deste e-mail. Peça um novo a um superadmin.";

/**
 * Passo 1 da ativação: o link do e-mail trouxe a sessão (no fragmento da URL)
 * e o token do convite (na query). Confere os dois juntos — a sessão prova a
 * caixa de e-mail, o token prova o convite — e instala a sessão no cookie.
 */
export async function claimInvite(input: {
  convite: string;
  accessToken: string;
  refreshToken: string;
}): Promise<ActionResult> {
  try {
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) throw new ActionError(INVALID, "INVALID");
    const { convite, accessToken, refreshToken } = parsed.data;

    const { ipHash } = await requestMeta();
    if (await isLocked("password", null, ipHash)) {
      throw new ActionError("Muitas tentativas. Aguarde alguns minutos.", "INVALID");
    }

    const svc = serviceClient();
    const { data: invite } = await svc
      .from("platform_admin_invite")
      .select("id, email, role, invited_by, expires_at, claimed_by, used_at, revoked_at")
      .eq("token_hash", sha256Hex(convite))
      .maybeSingle<InviteRow>();

    const { data: userData } = await anonClient().auth.getUser(accessToken);
    const user = userData?.user;

    const valid =
      invite &&
      user?.email &&
      !invite.used_at &&
      !invite.revoked_at &&
      new Date(invite.expires_at).getTime() > Date.now() &&
      (!invite.claimed_by || invite.claimed_by === user.id) &&
      user.email.toLowerCase() === invite.email;
    if (!valid || !user) {
      await recordAttempt("password", null, ipHash, false);
      throw new ActionError(INVALID, "INVALID");
    }

    const { data: current } = await svc
      .from("platform_admin")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle<{ status: string }>();
    if (current?.status === "suspended") throw new ActionError(INVALID, "INVALID");
    if (current?.status === "active") throw new ActionError("Este acesso já está ativo. Entre pelo login.", "INVALID");

    const { error: upsertError } = await svc.from("platform_admin").upsert(
      {
        user_id: user.id,
        email: invite.email,
        display_name: (user.user_metadata?.full_name as string | undefined)?.trim() || null,
        role: invite.role,
        status: "invited",
        invited_by: invite.invited_by,
        password_set_at: null,
      },
      { onConflict: "user_id" },
    );
    if (upsertError) throw new Error(upsertError.message);

    await svc
      .from("platform_admin_invite")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", invite.id);

    const supabase = await createSessionClient();
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw new ActionError(INVALID, "INVALID");

    await startAdminSession(accessToken, user.id);
    await writeAudit({
      actorId: user.id,
      actorEmail: invite.email,
      action: "admin.invite_claimed",
      resourceType: "admin_invite",
      resourceId: invite.id,
    });
    return { ok: true };
  } catch (e) {
    return actionFailure(e);
  }
}


/**
 * Passo 2: senha nova. Aqui a conta passa a ser só de quem tem a caixa de
 * e-mail: troca a senha, apaga fatores MFA anteriores e derruba todas as
 * outras sessões (inclusive de outros apps do Pet Live Pro).
 */
export async function setActivationPassword(password: string, confirm: string): Promise<ActionResult> {
  let ok = false;
  try {
    const p = await requireAdminAction({ allowPending: true, requireMfa: false });
    if (p.status !== "invited" || p.passwordSet) throw new ActionError("Nada a ativar nesta conta.", "INVALID");

    if (typeof password !== "string" || typeof confirm !== "string") {
      throw new ActionError("Senha inválida.", "INVALID");
    }
    const failed = failedPasswordRules(password, p.email);
    if (failed.length) {
      throw new ActionError(`A senha ainda precisa de: ${failed.map((r) => r.label.toLowerCase()).join(", ")}.`, "INVALID");
    }
    if (password !== confirm) throw new ActionError("As duas senhas não são iguais.", "INVALID");

    const svc = serviceClient();
    const { data: invite } = await svc
      .from("platform_admin_invite")
      .select("id, expires_at")
      .eq("claimed_by", p.userId)
      .is("used_at", null)
      .is("revoked_at", null)
      .maybeSingle<{ id: string; expires_at: string }>();
    if (!invite || new Date(invite.expires_at).getTime() < Date.now()) {
      throw new ActionError(INVALID, "INVALID");
    }

    const { error: pwError } = await svc.auth.admin.updateUserById(p.userId, { password });
    if (pwError) throw new ActionError("Não foi possível salvar a senha. Tente outra.", "INVALID");

    const { data: factors } = await svc.auth.admin.mfa.listFactors({ userId: p.userId });
    for (const factor of factors?.factors ?? []) {
      await svc.auth.admin.mfa.deleteFactor({ id: factor.id, userId: p.userId });
    }
    await svc.auth.admin.signOut(p.accessToken, "others");
    await revokeAllSessions(p.userId, "ativacao", p.sessionId);

    await svc
      .from("platform_admin")
      .update({ password_set_at: new Date().toISOString() })
      .eq("user_id", p.userId);
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.password_set",
      resourceType: "admin_member",
      resourceId: p.userId,
      afterData: { mfa_factors_removed: factors?.factors.length ?? 0 },
    });
    ok = true;
  } catch (e) {
    return actionFailure(e);
  }
  if (ok) redirect("/mfa");
  return { ok: true };
}
