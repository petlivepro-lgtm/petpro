"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { sendTestPush } from "@mylivepet/notifications";
import {
  NOTIFICATION_PAGE_SIZE,
  type NotificationItem,
} from "@/lib/notifications";

/**
 * Lista do sino. A RPC já filtra por tenant e papel de gestão, então não há
 * nada a conferir aqui — quem não é gestão recebe lista vazia.
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

export type SubscribeResult = { ok: boolean; error?: string };

/**
 * Guarda a inscrição de Web Push deste navegador e manda um aviso de teste na
 * sequência, para o gestor ver na hora que deu certo.
 *
 * O `endpoint` é único no banco: reinscrever o mesmo navegador atualiza a
 * linha existente em vez de acumular duplicatas.
 */
export async function savePushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}): Promise<SubscribeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada." };

  const tenant = await getActiveTenant(supabase, user.id);
  if (!tenant) return { ok: false, error: "Conta sem vínculo com petshop." };

  const { error } = await supabase.from("push_subscription").upsert(
    {
      tenant_id: tenant.tenantId,
      profile_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: "Não foi possível salvar a inscrição." };

  // O envio usa service role porque precisa ler o par de chaves da inscrição
  // recém-gravada e atualizar last_success_at — a RLS do próprio usuário
  // bastaria para ler, mas não para o dispatcher genérico.
  await sendTestPush(createAdminClient(), tenant.tenantId, user.id);
  return { ok: true };
}

/** Desliga os avisos deste navegador (o gestor pode ter vários aparelhos). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscription").delete().eq("endpoint", endpoint);
}
