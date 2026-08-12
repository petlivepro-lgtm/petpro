"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PASSWORD_LENGTH } from "./password-rules";

export type ResetResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

type ResetTarget = { status: "staff" | "not_found"; email?: string };

/** Em que estágio está o e-mail digitado na tela de login. */
export type AccessStatus = "existing" | "first_access" | "not_found";

export type IdentifyResult =
  | { ok: true; status: AccessStatus; fullName: string | null }
  | { ok: false; error: string };

export type ActivateResult = { ok: true } | { ok: false; error: string };

type AccessTarget = {
  status: AccessStatus;
  collaborator_id?: string | null;
  tenant_id?: string | null;
  full_name?: string | null;
  user_id?: string | null;
};

/**
 * Resolve o e-mail no servidor. A função é service_role only de propósito:
 * expor "esta conta existe" ao anon permitiria enumerar as contas do painel.
 */
async function resolveAccess(
  email: string,
): Promise<{ ok: true; target: AccessTarget } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("staff_access_target", { p_email: email });
  if (error) {
    return { ok: false, error: "Não foi possível verificar seu acesso. Tente novamente." };
  }
  return { ok: true, target: data as unknown as AccessTarget };
}

/**
 * Passo 1 do login: descobre se o e-mail já tem senha (pede a senha) ou se é
 * um convite de colaborador ainda não usado (deixa criar a senha).
 */
export async function identifyStaff(rawEmail: string): Promise<IdentifyResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe seu e-mail." };

  const resolved = await resolveAccess(email);
  if (!resolved.ok) return resolved;

  const { target } = resolved;
  if (target.status === "not_found") {
    return { ok: false, error: "E-mail não encontrado no painel do petshop." };
  }
  return { ok: true, status: target.status, fullName: target.full_name ?? null };
}

/**
 * Primeiro acesso do colaborador: cria a conta de auth já com a senha que ele
 * escolheu (e-mail marcado como confirmado, sem link de confirmação) e vincula
 * o cadastro do colaborador ao novo profile, com a membership COLLABORATOR.
 *
 * O estado é resolvido de novo aqui — nunca se confia no que o client mostrou.
 */
export async function activateCollaboratorAccess(
  rawEmail: string,
  password: string,
): Promise<ActivateResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Informe seu e-mail." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const resolved = await resolveAccess(email);
  if (!resolved.ok) return resolved;
  const { target } = resolved;

  if (target.status === "existing") {
    return { ok: false, error: "Este acesso já tem senha. Entre com ela." };
  }
  if (target.status !== "first_access") {
    return { ok: false, error: "E-mail não encontrado no painel do petshop." };
  }
  // O e-mail já pertence a uma conta do MyLivePet (um tutor, por exemplo).
  // Criar senha por cima seria tomar a conta — o petshop precisa usar outro
  // endereço. setCollaboratorAccess já barra isso no cadastro; aqui é a
  // segunda linha de defesa, para o caso de a conta ter nascido depois.
  if (target.user_id) {
    return {
      ok: false,
      error: "Este e-mail já tem uma conta no MyLivePet. Fale com o petshop.",
    };
  }

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: target.full_name ?? "" },
  });
  if (createError || !created?.user) {
    return { ok: false, error: "Não foi possível criar a senha. Tente novamente." };
  }

  const { error: linkError } = await admin.rpc("link_collaborator_access", {
    p_user_id: created.user.id,
    p_email: email,
  });
  if (linkError) {
    // Rollback: sem o vínculo a conta não serve para nada e travaria uma nova
    // tentativa (o e-mail passaria a existir em auth.users).
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: "Não foi possível criar a senha. Tente novamente." };
  }

  return { ok: true };
}

/** joana@gmail.com -> jo***@gmail.com (para confirmar o envio sem expor). */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - visible.length, 1))}@${domain}`;
}

/**
 * Link de redefinição de senha para quem acessa o painel. Só vale para conta
 * com membership — a checagem roda no servidor (service role) porque só
 * auth.users guarda o e-mail e devolver "existe/não existe" ao anon
 * permitiria enumerar as contas do painel.
 */
export async function sendStaffResetLink(rawEmail: string): Promise<ResetResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Informe seu e-mail." };
  }

  const admin = createAdminClient();
  const { data, error: rpcError } = await admin.rpc("staff_reset_target", {
    p_email: email,
  });
  if (rpcError) {
    return {
      ok: false,
      error: "Não foi possível verificar seu acesso. Tente novamente.",
    };
  }

  const target = data as unknown as ResetTarget;
  if (target.status !== "staff") {
    return { ok: false, error: "E-mail não encontrado no painel do petshop." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) {
    return { ok: false, error: "Não foi possível enviar o e-mail. Tente novamente." };
  }

  // Cliente sem PKCE e sem sessão só para disparar o e-mail.
  //
  // Com o fluxo PKCE (o padrão do @supabase/ssr) o pedido guarda um
  // code_verifier no aparelho que pediu, e o link só funciona nele — pedir no
  // celular e abrir no computador dava "link inválido ou expirado". Sem PKCE,
  // o Supabase devolve a sessão no próprio link, que passa a valer em
  // qualquer aparelho. O token fica exposto na URL, o que é aceitável aqui:
  // vale uma vez só, expira em 1 hora e serve apenas para trocar a senha.
  const otpClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false } },
  );
  const { error } = await otpClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${proto}://${host}/redefinir-senha`,
    },
  });
  if (error) {
    return {
      ok: false,
      error: "Não foi possível enviar o e-mail. Tente novamente em instantes.",
    };
  }

  return { ok: true, email: maskEmail(email) };
}
