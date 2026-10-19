import "server-only";
import { envVar } from "@/lib/env";
import { implicitClient } from "@/lib/supabase/service";
import { ActionError } from "@/lib/auth";

const PRO_APP = () => (envVar("PRO_APP_URL") ?? "https://app.petlivepro.com.br").replace(/\/+$/, "");
const TUTOR_APP = () => (envVar("TUTOR_APP_URL") ?? "https://tutor.petlivepro.com.br").replace(/\/+$/, "");

/** jo***@gmail.com — para confirmar o envio sem expor o endereço. */
export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Manda o link de redefinição de senha para o dono do petshop (painel) ou
 * para o tutor (app). O admin nunca vê nem define a senha de ninguém.
 */
export async function sendPasswordLink(email: string, target: "pro" | "tutor") {
  const redirect = `${target === "pro" ? PRO_APP() : TUTOR_APP()}/redefinir-senha`;
  const { error } = await implicitClient().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirect },
  });
  if (error) throw new ActionError("O e-mail não pôde ser enviado agora. Tente em alguns minutos.");
  return maskEmail(email);
}
