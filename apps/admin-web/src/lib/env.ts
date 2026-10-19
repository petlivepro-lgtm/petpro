import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Resolve uma variável do ambiente; se ausente (servidor não recarregou o env,
 * por ex.), faz fallback lendo o `.env` da raiz do monorepo direto do disco.
 */
export function envVar(key: string): string | undefined {
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

export function requiredEnv(key: string): string {
  const value = envVar(key);
  if (!value) throw new Error(`${key} ausente no ambiente do admin-web`);
  return value;
}

export const supabaseUrl = () => requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = () => requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
