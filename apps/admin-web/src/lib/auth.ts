// Porta de entrada única do admin: quem é, se pode, e por quanto tempo.
//
// Toda página (Server Component), toda Server Action e todo Route Handler
// chama requireAdminPage/requireAdminAction na primeira linha. O middleware
// só faz refresh de sessão e redirect de conveniência — ele NÃO é a fronteira
// de segurança. Server Actions são endpoints POST públicos: uma action que
// esqueça este guard fica aberta para qualquer um, por isso ele é curto e
// fácil de ver na revisão.
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { readJwtClaims } from "@/lib/security";
import { hasRole, isAdminRole, type AdminRole, type AdminStatus } from "@/lib/roles";

/** Sessão parada por mais que isto cai (minutos). */
export const IDLE_LIMIT_MIN = 30;
/** Idade máxima de uma sessão, mesmo em uso (horas). */
export const SESSION_LIMIT_H = 12;
/** Ações de governança exigem o código TOTP reconfirmado há menos disto. */
export const STEP_UP_LIMIT_MIN = 10;

export type AdminPrincipal = {
  userId: string;
  email: string;
  displayName: string;
  role: AdminRole;
  status: AdminStatus;
  passwordSet: boolean;
  aal2: boolean;
  sessionId: string;
  sessionCreatedAt: Date;
  stepUpAt: Date | null;
  accessToken: string;
};

type Resolution =
  | { ok: true; principal: AdminPrincipal }
  | { ok: false; reason: "no-session" | "not-admin" | "expired" };

type AdminRow = {
  email: string;
  display_name: string | null;
  role: string;
  status: AdminStatus;
  password_set_at: string | null;
};

type SessionRow = {
  user_id: string;
  created_at: string;
  last_seen_at: string;
  step_up_at: string | null;
  revoked_at: string | null;
};

/** Resolve o admin desta request uma vez só (React cache por request). */
const resolveAdmin = cache(async (): Promise<Resolution> => {
  const supabase = await createSessionClient();
  // getUser valida o JWT no servidor do Supabase; getSession sozinho apenas
  // leria o cookie, que pode ter sido forjado.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !user.email) return { ok: false, reason: "no-session" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: "no-session" };

  const claims = readJwtClaims(session.access_token);
  if (claims.sub !== user.id || !claims.session_id) return { ok: false, reason: "no-session" };

  const svc = serviceClient();
  const [{ data: admin }, { data: row }] = await Promise.all([
    svc
      .from("platform_admin")
      .select("email, display_name, role, status, password_set_at")
      .eq("user_id", user.id)
      .maybeSingle<AdminRow>(),
    svc
      .from("platform_admin_session")
      .select("user_id, created_at, last_seen_at, step_up_at, revoked_at")
      .eq("session_id", claims.session_id)
      .maybeSingle<SessionRow>(),
  ]);

  if (!admin || admin.status === "suspended" || !isAdminRole(admin.role)) {
    return { ok: false, reason: "not-admin" };
  }
  // Sessão sem linha nossa = não nasceu pelo login do admin (ex.: alguém
  // copiou o cookie de outro app do mesmo projeto). Não serve.
  if (!row || row.user_id !== user.id || row.revoked_at) {
    return { ok: false, reason: "expired" };
  }

  const now = Date.now();
  const createdAt = new Date(row.created_at);
  const lastSeen = new Date(row.last_seen_at).getTime();
  const tooOld = now - createdAt.getTime() > SESSION_LIMIT_H * 3600_000;
  const idle = now - lastSeen > IDLE_LIMIT_MIN * 60_000;
  if (tooOld || idle) {
    await svc
      .from("platform_admin_session")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: tooOld ? "idade" : "ociosidade" })
      .eq("session_id", claims.session_id)
      .is("revoked_at", null);
    return { ok: false, reason: "expired" };
  }
  if (now - lastSeen > 60_000) {
    await svc
      .from("platform_admin_session")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("session_id", claims.session_id);
  }

  return {
    ok: true,
    principal: {
      userId: user.id,
      email: admin.email,
      displayName: admin.display_name?.trim() || admin.email,
      role: admin.role,
      status: admin.status,
      passwordSet: Boolean(admin.password_set_at),
      aal2: claims.aal === "aal2",
      sessionId: claims.session_id,
      sessionCreatedAt: createdAt,
      stepUpAt: row.step_up_at ? new Date(row.step_up_at) : null,
      accessToken: session.access_token,
    },
  };
});

/** O admin desta request, sem redirecionar (para as telas de acesso). */
export async function peekAdmin(): Promise<AdminPrincipal | null> {
  const res = await resolveAdmin();
  return res.ok ? res.principal : null;
}

type GuardOptions = {
  /** Papel mínimo. Padrão: suporte (qualquer admin ativo). */
  minRole?: AdminRole;
  /** Aceita quem ainda está ativando o convite (senha/MFA). */
  allowPending?: boolean;
  /** Exige aal2 (código TOTP verificado nesta sessão). Padrão: sim. */
  requireMfa?: boolean;
};

/** Para Server Components: redireciona quando não pode. */
export async function requireAdminPage(options: GuardOptions = {}): Promise<AdminPrincipal> {
  const { minRole = "suporte", allowPending = false, requireMfa = true } = options;
  const res = await resolveAdmin();
  if (!res.ok) {
    redirect(res.reason === "expired" ? "/login?motivo=expirou" : "/login");
  }
  const p = res.principal;
  if (p.status === "invited" && !allowPending) {
    redirect(p.passwordSet ? "/mfa" : "/ativar");
  }
  if (requireMfa && !p.aal2) redirect("/mfa");
  if (!hasRole(p.role, minRole)) redirect("/sem-permissao");
  return p;
}

export class ActionError extends Error {
  constructor(
    message: string,
    readonly code: "AUTH" | "FORBIDDEN" | "STEP_UP" | "INVALID" | "FAILED" = "FAILED",
  ) {
    super(message);
  }
}

/** Para Server Actions e Route Handlers: lança ActionError quando não pode. */
export async function requireAdminAction(options: GuardOptions = {}): Promise<AdminPrincipal> {
  const { minRole = "suporte", allowPending = false, requireMfa = true } = options;
  const res = await resolveAdmin();
  if (!res.ok) throw new ActionError("Sua sessão terminou. Entre de novo.", "AUTH");
  const p = res.principal;
  if (p.status === "invited" && !allowPending) {
    throw new ActionError("Conclua a ativação do acesso.", "AUTH");
  }
  if (requireMfa && !p.aal2) throw new ActionError("Confirme o código do app autenticador.", "AUTH");
  if (!hasRole(p.role, minRole)) throw new ActionError("Seu papel não permite esta ação.", "FORBIDDEN");
  return p;
}

/** Ações de governança: o código TOTP precisa ter sido reconfirmado há pouco. */
export function requireStepUp(p: AdminPrincipal) {
  if (!p.stepUpAt || Date.now() - p.stepUpAt.getTime() > STEP_UP_LIMIT_MIN * 60_000) {
    throw new ActionError("Confirme com o código do app para continuar.", "STEP_UP");
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; code?: ActionError["code"] };

/** Converte qualquer erro em resposta segura (sem vazar detalhe interno). */
export function actionFailure(error: unknown): { ok: false; error: string; code?: ActionError["code"] } {
  if (error instanceof ActionError) return { ok: false, error: error.message, code: error.code };
  console.error("[admin-web] ação falhou:", error);
  return { ok: false, error: "Não foi possível concluir. Tente de novo.", code: "FAILED" };
}
