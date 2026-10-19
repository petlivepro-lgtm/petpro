import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { readJwtClaims, requestMeta } from "@/lib/security";

/** Registra a sessão recém-criada pelo login (ou pela ativação do convite). */
export async function startAdminSession(accessToken: string, userId: string) {
  const claims = readJwtClaims(accessToken);
  if (!claims.session_id || claims.sub !== userId) {
    throw new Error("Token sem session_id.");
  }
  const { ipHash, userAgent } = await requestMeta();
  const { error } = await serviceClient().from("platform_admin_session").upsert(
    {
      session_id: claims.session_id,
      user_id: userId,
      created_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      ip_hash: ipHash,
      user_agent: userAgent,
    },
    { onConflict: "session_id" },
  );
  if (error) throw new Error(`Falha ao registrar sessão: ${error.message}`);
}

export async function revokeSession(sessionId: string, reason: string) {
  await serviceClient()
    .from("platform_admin_session")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("session_id", sessionId)
    .is("revoked_at", null);
}

/** Derruba todas as sessões do admin (suspensão, troca de senha na ativação). */
export async function revokeAllSessions(userId: string, reason: string, exceptSessionId?: string) {
  let query = serviceClient()
    .from("platform_admin_session")
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (exceptSessionId) query = query.neq("session_id", exceptSessionId);
  await query;
}

export async function markStepUp(sessionId: string) {
  await serviceClient()
    .from("platform_admin_session")
    .update({ step_up_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}
