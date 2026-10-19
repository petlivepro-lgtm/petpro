import type { CookieOptions } from "@supabase/ssr";

/**
 * Cookie da sessão do admin. Diferente do painel e do app do tutor:
 *
 * - nome próprio, então a sessão do app./tutor. nunca vale aqui;
 * - HttpOnly: nenhum JavaScript da página lê o token (o admin não tem client
 *   Supabase no navegador — todo auth roda no servidor);
 * - SameSite=Strict e, em produção, prefixo `__Host-` (exige Secure, Path=/ e
 *   proíbe Domain, ou seja, o cookie fica preso a admin.petlivepro.com.br).
 *
 * Sem `server-only` de propósito: o middleware (edge) também importa isto.
 */
const isProd = process.env.NODE_ENV === "production";

export const SESSION_COOKIE = isProd ? "__Host-plp-admin" : "plp-admin";

/** Teto do cookie. A idade real da sessão é imposta no banco (12 h). */
export const SESSION_MAX_AGE = 60 * 60 * 12;

export const adminCookieOptions = {
  name: SESSION_COOKIE,
  path: "/",
  sameSite: "strict" as const,
  httpOnly: true,
  secure: isProd,
};

/**
 * O @supabase/ssr força maxAge de 400 dias em todo set. Aqui o cookie nunca
 * passa do teto, nunca ganha Domain e mantém as flags acima.
 */
export function clampCookie(options?: CookieOptions): CookieOptions {
  const maxAge =
    options?.maxAge === 0 ? 0 : Math.min(options?.maxAge ?? SESSION_MAX_AGE, SESSION_MAX_AGE);
  return {
    ...options,
    path: "/",
    sameSite: "strict",
    httpOnly: true,
    secure: isProd,
    domain: undefined,
    maxAge,
  };
}
