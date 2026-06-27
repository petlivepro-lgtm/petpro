import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@mylivepet/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Nome de cookie próprio: isola a sessão do app do tutor da sessão do CRM.
    { cookieOptions: { name: "sb-mylivepet-tutor" } },
  );
}
