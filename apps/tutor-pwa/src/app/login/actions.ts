"use server";

import { headers } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isValidPhoneBR, phoneDigits } from "@mylivepet/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "./password-rules";
import { phoneAuthEmail } from "./phone-account";

/** O tutor entra pelo e-mail ou pelo telefone (DDD + número, mascarado). */
export type Identifier = { kind: "email" | "phone"; value: string };

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ActivateResult = ActionResult;
export type ResetResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

type LoginTarget = {
  status: "not_found" | "first_access" | "existing" | "ambiguous";
  kind: "email" | "phone";
  user_id: string | null;
  auth_email: string | null;
  tutor_email: string | null;
  full_name: string | null;
  phone_digits: string | null;
};

type Resolved =
  | { ok: true; target: LoginTarget; identifier: string; digits: string }
  | { ok: false; error: string };

const INVALID_CREDENTIALS = "E-mail/telefone ou senha inválidos.";

function notFoundMessage(kind: Identifier["kind"]): string {
  return kind === "phone"
    ? "Telefone não encontrado. Procure o petshop para se cadastrar."
    : "E-mail não encontrado. Procure o petshop para se cadastrar.";
}

/**
 * Traduz o que o tutor digitou na ficha/conta correspondente. Toda a
 * resolução é feita aqui no servidor: devolver ao client o e-mail de uma
 * conta a partir do telefone permitiria enumerar tutores.
 */
async function resolveIdentifier(identifier: Identifier): Promise<Resolved> {
  const digits = identifier.kind === "phone" ? phoneDigits(identifier.value) : "";
  const value =
    identifier.kind === "phone" ? digits : identifier.value.trim().toLowerCase();

  if (identifier.kind === "phone" && !isValidPhoneBR(digits)) {
    return { ok: false, error: "Informe o DDD e o número do telefone." };
  }
  if (!value) {
    return {
      ok: false,
      error:
        identifier.kind === "phone" ? "Informe seu telefone." : "Informe seu e-mail.",
    };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("tutor_login_target", {
    p_identifier: value,
  });
  if (error) {
    return {
      ok: false,
      error: "Não foi possível verificar seu cadastro. Tente novamente.",
    };
  }

  return {
    ok: true,
    target: data as unknown as LoginTarget,
    identifier: value,
    digits,
  };
}

/** joana@gmail.com -> jo***@gmail.com (para confirmar o envio sem expor). */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - visible.length, 1))}@${domain}`;
}

/**
 * Ativa o acesso de um tutor no primeiro login: cria a conta de auth já com a
 * senha escolhida (e-mail marcado como confirmado, sem link de confirmação) e
 * vincula a ficha de tutor ao novo profile.
 *
 * Só funciona para e-mails/telefones que o petshop já cadastrou como tutor e
 * que ainda não têm senha — a checagem é refeita aqui no servidor, não se
 * confia no status que o client mostrou na tela.
 *
 * Ficha sem e-mail: a conta nasce com o endereço interno de phone-account.ts,
 * invisível para o tutor, que entra sempre pelo telefone.
 */
export async function activateTutorAccess(
  identifier: Identifier,
  password: string,
): Promise<ActivateResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    };
  }

  const resolved = await resolveIdentifier(identifier);
  if (!resolved.ok) return resolved;
  const { target, digits } = resolved;

  if (target.status === "ambiguous") {
    return {
      ok: false,
      error:
        "Este telefone está em mais de um cadastro. Entre com seu e-mail ou fale com o petshop.",
    };
  }
  if (target.status === "not_found") {
    return { ok: false, error: notFoundMessage(identifier.kind) };
  }
  if (target.status === "existing") {
    return {
      ok: false,
      error: "Este cadastro já tem senha. Entre com sua senha.",
    };
  }

  const admin = createAdminClient();

  // first_access: não existe conta de auth, ou existe uma sem senha (sobra do
  // link mágico), ou com a senha temporária do fluxo antigo (must_reset_password).
  // Nos três casos a senha passa a ser a que o tutor acabou de escolher.
  let userId = target.user_id;
  if (userId) {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      // limpa a flag do fluxo antigo, senão o middleware manda para /redefinir-senha
      user_metadata: { must_reset_password: false },
    });
    if (updateError) {
      return { ok: false, error: "Não foi possível criar a senha. Tente novamente." };
    }
  } else {
    const authEmail = target.auth_email ?? (digits ? phoneAuthEmail(digits) : null);
    if (!authEmail) {
      return {
        ok: false,
        error: "Seu cadastro não tem e-mail nem telefone. Procure o petshop.",
      };
    }
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: target.full_name ?? "",
        // conta que só existe por telefone: o e-mail é interno
        phone_login: !target.auth_email,
        phone_digits: digits || null,
      },
    });
    if (createError || !created?.user) {
      return { ok: false, error: "Não foi possível criar a senha. Tente novamente." };
    }
    userId = created.user.id;
  }

  const { error: linkError } = await admin.rpc("link_tutor_access_by", {
    p_user_id: userId,
    p_email: target.tutor_email ?? "",
    p_phone_digits: digits,
  });
  if (linkError) {
    return {
      ok: false,
      error: "Senha criada, mas houve falha ao vincular seu cadastro. Fale com o petshop.",
    };
  }

  return { ok: true };
}

/**
 * Login com senha. Roda no servidor porque, no acesso por telefone, só aqui
 * dá para descobrir com qual conta de auth autenticar — o client nunca vê
 * esse e-mail. A sessão é gravada nos cookies pelo client de @/lib/supabase/server.
 */
export async function signInTutor(
  identifier: Identifier,
  password: string,
): Promise<ActionResult> {
  const resolved = await resolveIdentifier(identifier);
  if (!resolved.ok) return resolved;
  const { target } = resolved;

  if (target.status === "ambiguous") {
    return {
      ok: false,
      error:
        "Este telefone está em mais de um cadastro. Entre com seu e-mail ou fale com o petshop.",
    };
  }

  // Para e-mail, o próprio valor digitado serve de fallback (conta de staff,
  // por exemplo, não devolve auth_email — ela é barrada logo abaixo).
  const authEmail =
    target.auth_email ?? (identifier.kind === "email" ? resolved.identifier : null);
  if (!authEmail) {
    return { ok: false, error: INVALID_CREDENTIALS };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (error || !data.user) {
    return { ok: false, error: INVALID_CREDENTIALS };
  }

  // O app do tutor é só para tutor: precisa de ficha vinculada e não pode ser staff.
  const [{ data: tutor }, { data: membership }] = await Promise.all([
    supabase.from("tutor").select("id").eq("profile_id", data.user.id).limit(1).maybeSingle(),
    supabase
      .from("membership")
      .select("profile_id")
      .eq("profile_id", data.user.id)
      .limit(1)
      .maybeSingle(),
  ]);
  if (!tutor || membership) {
    await supabase.auth.signOut();
    return { ok: false, error: "Você não tem permissão para acessar." };
  }

  return { ok: true };
}

/**
 * Link de redefinição por e-mail. Quem entrou pelo telefone só recebe o link
 * se a ficha tiver um e-mail de verdade — o endereço interno gerado a partir
 * do telefone não existe como caixa postal.
 */
export async function sendTutorResetLink(
  identifier: Identifier,
): Promise<ResetResult> {
  const resolved = await resolveIdentifier(identifier);
  if (!resolved.ok) return resolved;
  const { target } = resolved;

  if (target.status === "ambiguous") {
    return {
      ok: false,
      error:
        "Este telefone está em mais de um cadastro. Entre com seu e-mail ou fale com o petshop.",
    };
  }
  if (target.status === "not_found") {
    return { ok: false, error: notFoundMessage(identifier.kind) };
  }

  const email = target.tutor_email;
  if (!email) {
    return {
      ok: false,
      error:
        "Este cadastro não tem e-mail. Peça ao petshop para cadastrar um e-mail ou redefinir sua senha.",
    };
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
      emailRedirectTo: `${proto}://${host}/criar-senha`,
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
