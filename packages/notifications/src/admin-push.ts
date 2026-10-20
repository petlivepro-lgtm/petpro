// Web Push para a equipe do Pet Live Pro (apps/admin-web, migration 0081).
//
// Quem chama são os servidores dos apps, na hora do evento: o painel e o app
// do tutor quando um chamado é aberto ou respondido e quando um upload é
// barrado; o próprio admin quando um chamado é atribuído a alguém. Mesmas
// chaves VAPID do push do petshop/tutor.
//
// O texto é curto e sem conteúdo do cliente (nem assunto, nem mensagem): o
// aviso aparece na tela bloqueada do celular. O detalhe fica atrás do login
// com 2FA.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import { configurePush, deliver, type PushPayload } from "./push";

type Admin = SupabaseClient<Database>;

export type AdminAlert = PushPayload & {
  /** "support": toda a equipe ativa. "security": só admin e superadmin (quem vê Segurança). */
  audience: "support" | "security";
  /** Só estes administradores (ex.: o responsável pelo chamado). */
  userIds?: string[];
  /** Ninguém de `userIds` com aviso ligado: manda para o público inteiro. */
  fallbackToAll?: boolean;
};

const SECURITY_ROLES = ["admin", "superadmin"];
const TABLE = "platform_admin_push_subscription";

async function subscriptionsOf(admin: Admin, audience: AdminAlert["audience"], userIds?: string[]) {
  // Só administrador ativo: suspender corta os avisos na hora.
  let query = admin.from("platform_admin").select("user_id").eq("status", "active");
  if (audience === "security") query = query.in("role", SECURITY_ROLES);
  if (userIds?.length) query = query.in("user_id", userIds);
  const { data: admins } = await query;
  const ids = (admins ?? []).map((a) => a.user_id);
  if (!ids.length) return [];
  const { data } = await admin.from(TABLE).select("id, endpoint, p256dh, auth").in("user_id", ids);
  return data ?? [];
}

/** Avisa a equipe. Nunca lança: o evento que originou o aviso já aconteceu. */
export async function notifyPlatformAdmins(admin: Admin, alert: AdminAlert): Promise<number> {
  try {
    if (!configurePush()) return 0;
    const { audience, userIds, fallbackToAll, ...payload } = alert;
    let subs = await subscriptionsOf(admin, audience, userIds);
    if (!subs.length && userIds?.length && fallbackToAll) subs = await subscriptionsOf(admin, audience);
    if (!subs.length) return 0;
    return await deliver(admin, subs, payload, TABLE);
  } catch (e) {
    console.error("[push] aviso à equipe não enviado:", e);
    return 0;
  }
}

/** Confirmação logo depois de ativar os avisos no admin. */
export async function sendAdminTestPush(admin: Admin, userId: string): Promise<boolean> {
  if (!configurePush()) return false;
  const { data } = await admin.from(TABLE).select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!data?.length) return false;
  const sent = await deliver(
    admin,
    data,
    {
      title: "Avisos ativados",
      body: "Você vai receber aqui chamados novos, respostas de clientes e alertas de segurança.",
      href: "/suporte",
      tag: "admin-teste",
    },
    TABLE,
  );
  return sent > 0;
}
