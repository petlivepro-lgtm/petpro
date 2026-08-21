import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubinhoCreditDTO,
  ClubinhoScheduleDTO,
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

const SCHEDULE_SELECT =
  "id, subscription_id, weekday, start_time, service_type_id, active, service_type(name), collaborator(full_name)";

/**
 * Os horários fixos combinados com o petshop, por assinatura.
 *
 * Leitura pura: quem organiza a agenda dos profissionais é o petshop, e a RLS
 * (clubinho_schedule_tutor_read, 0052) só concede select. O tutor vê o
 * combinado para saber quando levar o pet — remarcar continua sendo conversa
 * com a loja.
 */
export async function loadMyClubinhoSchedules(
  supabase: SupabaseClient<Database>,
  subscriptionIds: string[],
): Promise<Map<string, ClubinhoScheduleDTO[]>> {
  const bySubscription = new Map<string, ClubinhoScheduleDTO[]>();
  if (subscriptionIds.length === 0) return bySubscription;

  const { data } = await supabase
    .from("clubinho_schedule")
    .select(SCHEDULE_SELECT)
    .in("subscription_id", subscriptionIds)
    .eq("active", true)
    .order("weekday")
    .order("start_time");

  for (const row of data ?? []) {
    const list = bySubscription.get(row.subscription_id) ?? [];
    list.push({
      id: row.id,
      subscription_id: row.subscription_id,
      weekday: row.weekday as ClubinhoScheduleDTO["weekday"],
      start_time: row.start_time,
      service_type_id: row.service_type_id,
      service_name:
        (row.service_type as { name: string } | null)?.name ?? "Serviço",
      // O tutor não escolhe o profissional, mas saber quem atende o pet toda
      // semana é parte do combinado.
      collaborator_id: "",
      collaborator_name:
        (row.collaborator as { full_name: string } | null)?.full_name ?? "",
      active: row.active,
    });
    bySubscription.set(row.subscription_id, list);
  }
  return bySubscription;
}
