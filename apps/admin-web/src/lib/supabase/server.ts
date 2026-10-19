import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { adminCookieOptions, clampCookie } from "./cookies";

/**
 * Cliente com a sessão do admin (cookie HttpOnly). Usado para o auth em si:
 * login, MFA, getUser. Os DADOS da plataforma vêm do serviceClient, depois
 * de requireAdmin — este cliente, com a RLS do usuário, não enxerga nada de
 * outros petshops.
 */
export async function createSessionClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookieOptions: adminCookieOptions,
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, clampCookie(options)));
        } catch {
          // Chamado de um Server Component: o middleware já faz o refresh.
        }
      },
    },
  });
}
