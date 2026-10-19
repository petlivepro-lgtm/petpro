#!/usr/bin/env node
// Cria o PRIMEIRO acesso administrativo (ou um superadmin novo), fora do
// painel — superadmin só nasce por aqui ou direto no banco.
//
// Uso (na raiz do monorepo):
//   pnpm --filter admin-web bootstrap-superadmin -- --email arthsousa.23@gmail.com --url https://admin.petlivepro.com.br
//
// Não dá acesso direto: manda o MESMO convite do painel. A pessoa abre o link
// do e-mail, cria uma senha nova (a anterior, se a conta já existia, deixa de
// valer), os fatores MFA antigos são apagados, as outras sessões caem e ela
// liga o app autenticador. Assim, mesmo que alguém tenha criado antes uma
// conta com esse e-mail, quem ativa é o dono da caixa de entrada.
//
// Pré-requisito no Supabase Auth: a URL `<url>/ativar` precisa estar em
// Authentication → URL Configuration → Redirect URLs; senão o Supabase manda
// o link para o Site URL e o token do convite se perde.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env };
try {
  for (const line of readFileSync(resolve(here, "../../../.env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // sem .env na raiz: usa só o ambiente
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = (arg("email") ?? "").trim().toLowerCase();
const role = arg("role") ?? "superadmin";
const origin = (arg("url") ?? env.ADMIN_APP_URL ?? "").replace(/\/+$/, "");

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Informe --email válido.");
  process.exit(1);
}
if (!["superadmin", "admin", "suporte"].includes(role)) {
  console.error("--role deve ser superadmin, admin ou suporte.");
  process.exit(1);
}
if (!/^https?:\/\/[^/]+$/.test(origin)) {
  console.error("Informe --url com a origem do admin (ex.: https://admin.petlivepro.com.br).");
  process.exit(1);
}
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { ...opts.auth, flowType: "implicit" },
});

const { data: existing } = await svc.from("platform_admin").select("status").eq("email", email).maybeSingle();
if (existing?.status === "active") {
  console.log(`${email} já é administrador ativo. Nada a fazer.`);
  process.exit(0);
}

await svc
  .from("platform_admin_invite")
  .update({ revoked_at: new Date().toISOString() })
  .eq("email", email)
  .is("used_at", null)
  .is("revoked_at", null);

const token = randomBytes(32).toString("base64url");
const { data: invite, error } = await svc
  .from("platform_admin_invite")
  .insert({
    email,
    role,
    token_hash: createHash("sha256").update(token).digest("hex"),
    invited_by: null,
    reason: "Bootstrap pelo script do servidor",
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  })
  .select("id")
  .single();
if (error) {
  console.error("Não foi possível criar o convite:", error.message);
  process.exit(1);
}

const redirectTo = `${origin}/ativar?convite=${encodeURIComponent(token)}`;
const invited = await svc.auth.admin.inviteUserByEmail(email, { redirectTo });
if (invited.error) {
  const sent = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  });
  if (sent.error) {
    await svc.from("platform_admin_invite").update({ revoked_at: new Date().toISOString() }).eq("id", invite.id);
    console.error("O e-mail não pôde ser enviado:", sent.error.message);
    process.exit(1);
  }
}

await svc.from("platform_admin_audit").insert({
  actor_id: null,
  actor_email: "bootstrap",
  action: "admin.invited",
  resource_type: "admin_invite",
  resource_id: invite.id,
  reason: "Bootstrap pelo script do servidor",
  after_data: { email, role },
});

console.log(`Convite de ${role} enviado para ${email}. O link vale 24 horas e abre ${origin}/ativar.`);
