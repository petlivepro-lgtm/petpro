"use server";

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { peekAdmin } from "@/lib/auth";
import { revokeSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

/** Sair: revoga a sessão no banco e no Supabase e limpa o cookie. */
export async function logoutAction() {
  const p = await peekAdmin();
  if (p) {
    await revokeSession(p.sessionId, "logout");
    await writeAudit({
      actorId: p.userId,
      actorEmail: p.email,
      action: "admin.logout",
      resourceType: "admin_session",
      resourceId: p.sessionId,
    }).catch(() => undefined);
  }
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login?motivo=saiu");
}
