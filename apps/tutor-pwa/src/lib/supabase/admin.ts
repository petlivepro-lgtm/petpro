import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";

/**
 * Resolve uma variável do ambiente; se ausente (servidor não recarregou o env,
 * por ex.), faz fallback lendo o `.env` da raiz do monorepo direto do disco.
 */
function envVar(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const rootEnv = resolve(process.cwd(), "../../.env");
    for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && m[1] === key) return m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env da raiz ausente — segue sem fallback.
  }
  return undefined;
}

/** Cliente com service role — IGNORA RLS. Usar SOMENTE em Server Actions. */
export function createAdminClient() {
  const url = envVar("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = envVar("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY/URL ausente no ambiente do tutor-pwa");
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
