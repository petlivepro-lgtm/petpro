// Envio de Web Push para o painel do petshop (pro-web).
//
// Roda no servidor dos DOIS apps: o tutor-pwa chama dispatchPendingPush logo
// depois de gravar a solicitação (é ele quem sabe que algo aconteceu), e o
// pro-web usa sendTestPush ao ativar os avisos, para o gestor ver na hora que
// funcionou. A lib web-push é Node puro — nunca importe isto de um client
// component.
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";

type Admin = SupabaseClient<Database>;

/** Payload que o service worker (public/sw.js) espera receber. */
export type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
  tag?: string;
};

// O `.env` da raiz do monorepo já é injetado em process.env pelo next.config.mjs
// de cada app, então basta ler daqui.
function envVar(key: string): string | undefined {
  return process.env[key] || undefined;
}

let configured: boolean | null = null;

/**
 * Configura o VAPID uma única vez por processo. Sem as chaves, o push
 * simplesmente não acontece — o sino no painel continua funcionando, e é por
 * isso que nada aqui lança erro.
 */
function configure(): boolean {
  if (configured !== null) return configured;
  const publicKey = envVar("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = envVar("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    envVar("VAPID_SUBJECT") || "mailto:contato@petlivepro.com.br",
    publicKey,
    privateKey,
  );
  configured = true;
  return true;
}

/** O push está configurado neste ambiente? Usado para esconder a UI de ativação. */
export function isPushConfigured(): boolean {
  return configure();
}

type Subscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/**
 * Entrega um payload a uma lista de inscrições. Endpoint morto (404/410) é
 * apagado: o navegador foi desinstalado, a permissão revogada ou a inscrição
 * expirou, e insistir só gera erro em toda notificação futura.
 */
async function deliver(
  admin: Admin,
  subs: Subscription[],
  payload: PushPayload,
): Promise<number> {
  const body = JSON.stringify(payload);
  const dead: string[] = [];
  const alive: string[] = [];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24 },
        );
        alive.push(sub.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          // Chave VAPID trocada, serviço de push fora do ar, rede bloqueada:
          // sem este log, um push que parou de sair não deixa rastro nenhum.
          console.error(
            "[push] falha ao enviar",
            status ?? (err as Error)?.message ?? err,
          );
        }
      }
    }),
  );

  if (dead.length) {
    await admin.from("push_subscription").delete().in("id", dead);
  }
  if (alive.length) {
    await admin
      .from("push_subscription")
      .update({ last_success_at: new Date().toISOString() })
      .in("id", alive);
  }
  return alive.length;
}

async function subscriptionsFor(
  admin: Admin,
  tenantId: string,
  profileId?: string,
): Promise<Subscription[]> {
  let query = admin
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId);
  if (profileId) query = query.eq("profile_id", profileId);
  const { data } = await query;
  return data ?? [];
}

/**
 * Inscrições de quem enxerga o mural da gestão. Espelha `is_management` do
 * banco (0040): todo papel menos COLLABORATOR — ele só recebe o que é
 * endereçado a ele, e receberia os pedidos dos tutores sem poder atendê-los.
 */
async function managementSubscriptions(
  admin: Admin,
  tenantId: string,
): Promise<Subscription[]> {
  const { data: members } = await admin
    .from("membership")
    .select("profile_id")
    .eq("tenant_id", tenantId)
    .neq("role", "COLLABORATOR");

  const ids = (members ?? []).map((m) => m.profile_id);
  if (!ids.length) return [];

  const { data } = await admin
    .from("push_subscription")
    .select("id, endpoint, p256dh, auth")
    .eq("tenant_id", tenantId)
    .in("profile_id", ids);
  return data ?? [];
}

/**
 * Envia como push tudo o que os gatilhos do banco criaram e ainda não saiu.
 *
 * A reserva das linhas é o próprio UPDATE de `pushed_at` filtrando por
 * `pushed_at is null`: se dois tutores agirem ao mesmo tempo, cada processo
 * leva um conjunto distinto e ninguém recebe a mesma notificação duas vezes.
 *
 * Nunca lança: um push que falha não pode derrubar o agendamento do tutor.
 */
export async function dispatchPendingPush(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  try {
    if (!configure()) return 0;

    const { data: claimed } = await admin
      .from("notification")
      .update({ pushed_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .is("pushed_at", null)
      .select("id, title, body, href, recipient_profile_id");

    if (!claimed?.length) return 0;

    // Cada caixa vai para o seu público: sem destinatário é mural da gestão,
    // com destinatário é privado daquela pessoa (colaborador, tipicamente).
    // Marcar antes de olhar as inscrições é de propósito: quem ativar o push
    // amanhã não deve receber de enxurrada tudo o que aconteceu antes disso.
    const boxes = new Map<string | null, typeof claimed>();
    for (const n of claimed) {
      const key = n.recipient_profile_id;
      const box = boxes.get(key);
      if (box) box.push(n);
      else boxes.set(key, [n]);
    }

    let delivered = 0;
    for (const [recipient, group] of boxes) {
      const subs = recipient
        ? await subscriptionsFor(admin, tenantId, recipient)
        : await managementSubscriptions(admin, tenantId);
      if (!subs.length) continue;

      // Uma leva com vários itens vira um aviso só: a pessoa abre o painel e
      // vê todos de uma vez, e empilhar cinco notificações do sistema irrita.
      const [first] = group;
      const payload: PushPayload =
        group.length === 1 && first
          ? {
              title: first.title,
              body: first.body,
              href: first.href,
              tag: `notif-${first.id}`,
            }
          : {
              title: `${group.length} novos avisos`,
              body: group.map((n) => n.body).join("\n"),
              href: recipient ? "/atendimentos" : "/solicitacoes",
              tag: `notif-lote-${recipient ?? "gestao"}`,
            };

      delivered += await deliver(admin, subs, payload);
    }
    return delivered;
  } catch {
    // Push é o canal secundário — o registro no sino já está gravado.
    return 0;
  }
}

/** Aviso de confirmação disparado logo após o gestor permitir as notificações. */
export async function sendTestPush(
  admin: Admin,
  tenantId: string,
  profileId: string,
): Promise<boolean> {
  if (!configure()) return false;
  const subs = await subscriptionsFor(admin, tenantId, profileId);
  if (!subs.length) return false;
  const sent = await deliver(admin, subs, {
    title: "Avisos ativados",
    body: "Pronto! Você vai receber aqui as solicitações dos tutores.",
    href: "/solicitacoes",
    tag: "notif-teste",
  });
  return sent > 0;
}
