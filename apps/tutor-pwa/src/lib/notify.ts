import { dispatchPendingPush } from "@mylivepet/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Manda, como aviso do navegador, o que o tutor acabou de fazer.
 *
 * O registro em si é criado pelos gatilhos (0040/0042) — aqui só
 * empurramos o que ainda não saiu, para a gestão ou para o colaborador que o
 * tutor escolheu. Chamar isto logo depois da ação é o que faz
 * o aviso chegar mesmo com o painel fechado; o sino já funcionaria sozinho.
 *
 * Nunca lança e nunca bloqueia o resultado da ação: se o push falhar, o pedido
 * do tutor continua valendo e a notificação segue no sino do painel.
 */
export async function dispatchNotifications(tenantId: string): Promise<void> {
  try {
    await dispatchPendingPush(createAdminClient(), tenantId);
  } catch {
    // Canal secundário: silencioso de propósito.
  }
}
