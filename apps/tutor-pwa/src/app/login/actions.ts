"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PASSWORD_LENGTH } from "./password-rules";

export type ActivateResult = { ok: true } | { ok: false; error: string };

type FirstAccessTarget = {
  status: "not_found" | "first_access" | "existing";
  user_id: string | null;
  full_name: string | null;
};

/**
 * Ativa o acesso de um tutor no primeiro login: cria a conta de auth já com a
 * senha escolhida (e-mail marcado como confirmado, sem link de confirmação) e
 * vincula a ficha de tutor ao novo profile.
 *
 * Só funciona para e-mails que o petshop já cadastrou como tutor e que ainda
 * não têm senha — a checagem é refeita aqui no servidor, não se confia no
 * status que o client mostrou na tela.
 */
export async function activateTutorAccess(
  email: string,
  password: string,
): Promise<ActivateResult> {
  const value = email.trim().toLowerCase();
  if (!value) return { ok: false, error: "Informe seu e-mail." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const admin = createAdminClient();

  const { data, error } = await admin.rpc("tutor_first_access_target", { p_email: value });
  if (error) {
    return { ok: false, error: "Não foi possível verificar o e-mail. Tente novamente." };
  }

  const target = data as unknown as FirstAccessTarget;
  if (target.status === "not_found") {
    return { ok: false, error: "E-mail não encontrado. Procure o petshop para se cadastrar." };
  }
  if (target.status === "existing") {
    return {
      ok: false,
      error: "Este e-mail já tem senha cadastrada. Entre com sua senha.",
    };
  }

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
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: value,
      password,
      email_confirm: true,
      user_metadata: { full_name: target.full_name ?? "" },
    });
    if (createError || !created?.user) {
      return { ok: false, error: "Não foi possível criar a senha. Tente novamente." };
    }
    userId = created.user.id;
  }

  const { error: linkError } = await admin.rpc("link_tutor_access", {
    p_user_id: userId,
    p_email: value,
  });
  if (linkError) {
    return {
      ok: false,
      error: "Senha criada, mas houve falha ao vincular seu cadastro. Fale com o petshop.",
    };
  }

  return { ok: true };
}
