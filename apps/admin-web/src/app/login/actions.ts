"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { privateHash, readJwtClaims, requestMeta } from "@/lib/security";
import { isLocked, LOCK_WINDOW_MIN, recordAttempt } from "@/lib/rate-limit";
import { startAdminSession } from "@/lib/session";
import { writeAudit } from "@/lib/audit";

export type LoginState = { error?: string } | undefined;

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

// Uma mensagem só para "não existe", "senha errada" e "não é admin": o
// formulário não pode servir para descobrir quais contas são administrativas.
const GENERIC = "E-mail ou senha inválidos.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: GENERIC };
  const { email, password } = parsed.data;

  const { ipHash } = await requestMeta();
  const emailHash = privateHash(email);
  if (await isLocked("password", emailHash, ipHash)) {
    return { error: `Muitas tentativas. Aguarde ${LOCK_WINDOW_MIN} minutos e tente de novo.` };
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    await recordAttempt("password", emailHash, ipHash, false);
    return { error: GENERIC };
  }

  const { data: admin } = await serviceClient()
    .from("platform_admin")
    .select("status, password_set_at")
    .eq("user_id", data.user.id)
    .maybeSingle<{ status: string; password_set_at: string | null }>();

  // Convite em andamento só entra por senha depois de criar a senha nova na
  // ativação — antes disso a senha é a de quem criou a conta, não a do admin.
  const allowed =
    admin && (admin.status === "active" || (admin.status === "invited" && admin.password_set_at));
  if (!allowed) {
    await supabase.auth.signOut({ scope: "local" });
    await recordAttempt("password", emailHash, ipHash, false);
    return { error: GENERIC };
  }

  await recordAttempt("password", emailHash, ipHash, true);
  await startAdminSession(data.session.access_token, data.user.id);
  await writeAudit({
    actorId: data.user.id,
    actorEmail: email,
    action: "admin.login",
    resourceType: "admin_session",
    resourceId: readJwtClaims(data.session.access_token).session_id ?? null,
  });

  redirect("/mfa");
}
