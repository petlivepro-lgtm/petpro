import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@mylivepet/types/database";

/** Cliente Supabase para Client Components. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Nome de cookie próprio: isola a sessão do CRM da sessão do app do tutor
    // (no mesmo navegador/projeto Supabase, senão uma sobrescreve a outra).
    { cookieOptions: { name: "sb-mylivepet-pro" } },
  );
}
