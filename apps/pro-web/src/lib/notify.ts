import "server-only";
import { dispatchPendingPush } from "@mylivepet/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Empurra como aviso do navegador o que os gatilhos acabaram de registrar.
 *
 * No painel isso serve ao colaborador: confirmar uma solicitação, passar um
 * atendimento para outro profissional ou cancelar mexe na agenda de alguém que
 * pode não estar com o Pet Live Pro aberto.
 *
 * Nunca lança: push é canal secundário, e a notificação já está no sino.
 */
export async function dispatchNotifications(tenantId: string): Promise<void> {
  try {
    await dispatchPendingPush(createAdminClient(), tenantId);
  } catch {
    // Silencioso de propósito — o erro de envio já é logado no dispatcher.
  }
}
