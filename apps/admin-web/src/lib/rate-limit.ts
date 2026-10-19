import "server-only";
import { serviceClient } from "@/lib/supabase/service";

/** Janela e limites de força bruta (login por senha e código MFA). */
export const LOCK_WINDOW_MIN = 15;
const MAX_FAILURES_PER_IDENTITY = 5;
const MAX_FAILURES_PER_IP = 20;

type Kind = "password" | "mfa";

export async function isLocked(kind: Kind, emailHash: string | null, ipHash: string): Promise<boolean> {
  const svc = serviceClient();
  const since = new Date(Date.now() - LOCK_WINDOW_MIN * 60_000).toISOString();

  const byIp = svc
    .from("platform_admin_login_attempt")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("ip_hash", ipHash)
    .eq("success", false)
    .gte("created_at", since);

  const byIdentity = emailHash
    ? svc
        .from("platform_admin_login_attempt")
        .select("id", { count: "exact", head: true })
        .eq("kind", kind)
        .eq("email_hash", emailHash)
        .eq("success", false)
        .gte("created_at", since)
    : null;

  const [ip, identity] = await Promise.all([byIp, byIdentity]);
  if ((ip.count ?? 0) >= MAX_FAILURES_PER_IP) return true;
  return (identity?.count ?? 0) >= MAX_FAILURES_PER_IDENTITY;
}

export async function recordAttempt(kind: Kind, emailHash: string | null, ipHash: string, success: boolean) {
  await serviceClient()
    .from("platform_admin_login_attempt")
    .insert({ kind, email_hash: emailHash, ip_hash: ipHash, success });
}
