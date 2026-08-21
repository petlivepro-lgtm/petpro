import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubinhoCreditDTO,
  ClubinhoSubscriptionDTO,
  Database,
} from "@mylivepet/types";

// Leitura do Clubinho no app do tutor. A RLS já recorta por tutor
// (clubinho_subscription_tutor_read, 0047), então basta filtrar pelo que a
// tela precisa.
//
// O select fica em constante de módulo: o supabase-js infere o tipo da linha a
// partir do literal, e montar a string na chamada quebra a inferência.
const SUBSCRIPTION_SELECT =
  "id, pet_id, tutor_id, plan_id, status, price_cents, started_on, period_start, period_end, auto_renew, payment_method, terminal_id, installments, notes, cancelled_at, cancellation_reason, created_at, plan_name, plan_cycle, plan_cycle_days, plan_rollover, plan_price_cents, plan_active, pet_name, pet_photo_path, pet_species, tutor_name, tutor_phone, period_id, current_period_start, current_period_end, credits, credits_total, credits_used, credits_left";

/**
 * Renova os ciclos vencidos antes de mostrar o saldo.
 *
 * Sem cron no projeto, a rotina roda no carregamento — e o tutor também a
 * dispara, senão ele veria "ciclo vencido" até alguém do petshop abrir o
 * painel. A RPC é idempotente e só aceita o tenant de quem chama.
 */
export async function syncClubinhoPeriods(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const { error } = await supabase.rpc("clubinho_sync_periods", {
    p_tenant: tenantId,
  });
  if (error) console.warn(`[clubinho] renovação adiada: ${error.message}`);
}

/** Assinaturas abertas dos pets do tutor, com o saldo do ciclo corrente. */
export async function loadMyClubinho(
  supabase: SupabaseClient<Database>,
  tutorId: string,
): Promise<ClubinhoSubscriptionDTO[]> {
  const { data } = await supabase
    .from("clubinho_subscription_view")
    .select(SUBSCRIPTION_SELECT)
    .eq("tutor_id", tutorId)
    .in("status", ["ACTIVE", "PAUSED"])
    .order("pet_name");

  return (data ?? []).map((row) => ({
    ...(row as unknown as ClubinhoSubscriptionDTO),
    // `credits` chega como jsonb.
    credits: Array.isArray(row.credits)
      ? (row.credits as ClubinhoCreditDTO[])
      : [],
  }));
}
