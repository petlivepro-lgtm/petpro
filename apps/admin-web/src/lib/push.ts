import "server-only";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import { notifyPlatformAdmins, type AdminAlert } from "@mylivepet/notifications";
import { requiredEnv, supabaseUrl } from "@/lib/env";

/** Service role com os tipos gerados: o pacote de notificações exige o client tipado. */
export function typedServiceClient() {
  return createClient<Database>(supabaseUrl(), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Push para a equipe depois da resposta da action: o envio nunca atrasa a tela. */
export function alertTeam(alert: AdminAlert) {
  after(() => notifyPlatformAdmins(typedServiceClient(), alert));
}
