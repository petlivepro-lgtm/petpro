"use server";

import { z } from "zod";
import { sendAdminTestPush } from "@mylivepet/notifications";
import { actionFailure, requireAdminAction } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { typedServiceClient } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
  userAgent: z.string().max(300).optional(),
});

/**
 * Liga os avisos deste navegador para o administrador logado. O mesmo
 * navegador usado por outra pessoa da equipe passa a avisar quem ativou por
 * último (a inscrição é do aparelho).
 */
export async function saveAdminPushSubscription(input: z.input<typeof subscriptionSchema>): Promise<{ ok: boolean; error?: string }> {
  try {
    const p = await requireAdminAction();
    const parsed = subscriptionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "O navegador devolveu uma inscrição inválida." };
    const { error } = await serviceClient()
      .from("platform_admin_push_subscription")
      .upsert(
        {
          user_id: p.userId,
          endpoint: parsed.data.endpoint,
          p256dh: parsed.data.p256dh,
          auth: parsed.data.auth,
          user_agent: parsed.data.userAgent ?? null,
        },
        { onConflict: "endpoint" },
      );
    if (error) return { ok: false, error: "Não foi possível salvar a inscrição." };
    await sendAdminTestPush(typedServiceClient(), p.userId);
    return { ok: true };
  } catch (e) {
    const failure = actionFailure(e);
    return { ok: false, error: failure.error };
  }
}

/** Desliga os avisos deste navegador. */
export async function removeAdminPushSubscription(endpoint: string): Promise<void> {
  const p = await requireAdminAction();
  await serviceClient().from("platform_admin_push_subscription").delete().eq("endpoint", endpoint).eq("user_id", p.userId);
}
