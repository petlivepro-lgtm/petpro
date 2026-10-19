import "server-only";
import { headers } from "next/headers";
import { envVar } from "@/lib/env";
import { implicitClient, serviceClient } from "@/lib/supabase/service";
import { randomToken, sha256Hex } from "@/lib/security";
import { ActionError } from "@/lib/auth";
import type { AdminRole } from "@/lib/roles";

export const INVITE_TTL_H = 24;

/** Origem pública do admin (para o link do e-mail). */
async function adminOrigin(): Promise<string> {
  const configured = envVar("ADMIN_APP_URL");
  if (configured) return configured.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) throw new ActionError("Não foi possível montar o link do convite.");
  return `${proto}://${host}`;
}

/**
 * Cria o convite e manda o link por e-mail (Supabase Auth).
 *
 * E-mail sem conta → convite do Supabase (cria a conta sem senha).
 * E-mail com conta → link mágico. Nos dois casos, clicar prova a posse da
 * caixa de e-mail, e a ativação força senha nova, apaga fatores MFA antigos e
 * derruba as outras sessões da conta — quem tivesse criado a conta antes com
 * esse e-mail (o /cadastrar do painel não confirma e-mail) perde o acesso.
 */
export async function createInvite(input: {
  email: string;
  role: AdminRole;
  invitedBy: string | null;
  reason: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const svc = serviceClient();

  const { data: existing } = await svc
    .from("platform_admin")
    .select("status")
    .eq("email", email)
    .maybeSingle<{ status: string }>();
  if (existing?.status === "active") {
    throw new ActionError("Este e-mail já é administrador.", "INVALID");
  }
  if (existing?.status === "suspended") {
    throw new ActionError("Este acesso está suspenso. Reative em vez de convidar.", "INVALID");
  }

  // Um convite em aberto por e-mail: o novo substitui o anterior.
  await svc
    .from("platform_admin_invite")
    .update({ revoked_at: new Date().toISOString() })
    .eq("email", email)
    .is("used_at", null)
    .is("revoked_at", null);

  const token = randomToken();
  const { data: invite, error } = await svc
    .from("platform_admin_invite")
    .insert({
      email,
      role: input.role,
      token_hash: sha256Hex(token),
      invited_by: input.invitedBy,
      reason: input.reason,
      expires_at: new Date(Date.now() + INVITE_TTL_H * 3600_000).toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !invite) throw new ActionError("Não foi possível criar o convite.");

  const redirectTo = `${await adminOrigin()}/ativar?convite=${encodeURIComponent(token)}`;

  const invited = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (invited.error) {
    const sent = await implicitClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
    });
    if (sent.error) {
      await svc
        .from("platform_admin_invite")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", invite.id);
      throw new ActionError("O e-mail do convite não pôde ser enviado. Tente de novo em instantes.");
    }
  }

  return { inviteId: invite.id, email };
}
