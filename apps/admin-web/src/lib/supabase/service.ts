// Este módulo carrega a service role key, que IGNORA a RLS. O import abaixo
// quebra o build se algum dia ele for parar num bundle de client — melhor um
// erro de compilação do que a chave publicada no JavaScript do navegador.
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requiredEnv, supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Service role — enxerga a plataforma inteira. Só pode ser chamado DEPOIS de
 * requireAdmin (lib/auth.ts). Sem tipos gerados de propósito: as tabelas e
 * RPCs do admin são lidas por funções com tipo próprio em lib/data.
 */
export function serviceClient(): SupabaseClient {
  return createClient(supabaseUrl(), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Cliente anônimo, sem sessão, para validar um token avulso (convite). */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Cliente sem PKCE para disparar e-mail de link mágico. Com PKCE o link só
 * funcionaria no navegador que pediu (o code_verifier fica nele) — aqui quem
 * pede é o servidor, e o link precisa abrir no aparelho de quem recebe.
 */
export function implicitClient(): SupabaseClient {
  return createClient(supabaseUrl(), supabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false, flowType: "implicit" },
  });
}
