"use server";

import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import {
  NOTIFICATION_PAGE_SIZE,
  type NotificationItem,
  type SavePushResult,
} from "@mylivepet/ui";

/**
 * Lista do sino. A RPC (0040/0042) só devolve o que é endereçado a quem está
 * logado, então o tutor nunca alcança o mural do petshop nem a caixa de outro
 * tutor — não há o que filtrar aqui.
 */
export async function listNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_notifications", {
    p_limit: NOTIFICATION_PAGE_SIZE,
  });
  return (data ?? []) as NotificationItem[];
}

/** Marca como lidas. Sem ids, marca tudo. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", {
    p_ids: ids && ids.length ? ids : undefined,
  });
}

/**
 * Guarda a inscrição de Web Push deste aparelho.
 *
 * O `endpoint` é único no banco: reinscrever o mesmo navegador atualiza a linha
 * existente em vez de acumular duplicatas.
 *
 * Diferente do painel, aqui não sai um aviso de teste: quem acabou de tocar no
 * botão está com o app na mão, e a confirmação visual do próprio botão basta.
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<SavePushResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada." };

  const ctx = await getTutorContext(supabase, user.id);
  if (!ctx) return { ok: false, error: "Conta sem vínculo com petshop." };

  const { error } = await supabase.from("push_subscription").upsert(
    {
      tenant_id: ctx.tenantId,
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: "Não foi possível salvar a inscrição." };

  return { ok: true };
}

/** Desliga os avisos deste aparelho (o tutor pode ter celular e computador). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscription").delete().eq("endpoint", endpoint);
}
