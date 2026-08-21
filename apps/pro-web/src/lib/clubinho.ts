import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClubinhoCreditDTO,
  ClubinhoOccurrenceDTO,
  ClubinhoPlanDTO,
  ClubinhoScheduleDTO,
  ClubinhoSubscriptionDTO,
  Database,
} from "@mylivepet/types";

// Leitura do Clubinho (supabase/migrations/0047_clubinho_plans.sql).
//
// Os selects ficam em constantes de módulo, e não montados na chamada: o
// supabase-js infere o tipo da linha a partir do literal, e concatenar a
// string quebra a inferência.

const PLAN_SELECT =
  "id, name, description, price_cents, cycle, cycle_days, rollover, active, position, clubinho_plan_item(service_type_id, quantity, service_type(name))";

const SUBSCRIPTION_SELECT =
  "id, pet_id, tutor_id, plan_id, status, price_cents, started_on, period_start, period_end, auto_renew, payment_method, terminal_id, installments, notes, cancelled_at, cancellation_reason, created_at, plan_name, plan_cycle, plan_cycle_days, plan_rollover, plan_price_cents, plan_active, pet_name, pet_photo_path, pet_species, tutor_name, tutor_phone, period_id, current_period_start, current_period_end, credits, credits_total, credits_used, credits_left";

/**
 * Renova os ciclos vencidos do petshop antes de ler o saldo.
 *
 * O projeto não tem cron, então a rotina roda no carregamento das telas que
 * dependem do saldo. É idempotente e barata (índice parcial sobre assinaturas
 * ativas vencidas), e falhar aqui não pode derrubar a página: no pior caso o
 * saldo aparece do ciclo anterior até a próxima visita.
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

/**
 * Renova os ciclos e, em seguida, transforma os horários fixos nos
 * agendamentos do ciclo.
 *
 * A ordem importa: a materialização procura o saldo do ciclo corrente, e num
 * ciclo que acabou de vencer esse saldo só existe depois da renovação.
 */
export async function syncClubinho(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  await syncClubinhoPeriods(supabase, tenantId);
  const { error } = await supabase.rpc("clubinho_materialize_bookings", {
    p_tenant: tenantId,
  });
  if (error) console.warn(`[clubinho] agendamentos adiados: ${error.message}`);
}

/** Planos do petshop, com os serviços de cada um e quantos pets já assinam. */
export async function loadClubinhoPlans(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  { activeOnly = false }: { activeOnly?: boolean } = {},
): Promise<ClubinhoPlanDTO[]> {
  let query = supabase
    .from("clubinho_plan")
    .select(PLAN_SELECT)
    .eq("tenant_id", tenantId);
  if (activeOnly) query = query.eq("active", true);

  const [{ data: plans }, { data: subs }] = await Promise.all([
    query.order("position").order("name"),
    // Só as abertas: o contador serve para avisar quem seria afetado por uma
    // mudança de plano, e assinatura cancelada não é mais afetada por nada.
    supabase
      .from("clubinho_subscription")
      .select("plan_id, status")
      .eq("tenant_id", tenantId)
      .in("status", ["ACTIVE", "PAUSED"]),
  ]);

  const subscribers = new Map<string, number>();
  for (const row of subs ?? []) {
    subscribers.set(row.plan_id, (subscribers.get(row.plan_id) ?? 0) + 1);
  }

  return (plans ?? []).map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price_cents: plan.price_cents,
    cycle: plan.cycle,
    cycle_days: plan.cycle_days,
    rollover: plan.rollover,
    active: plan.active,
    position: plan.position,
    items: (plan.clubinho_plan_item ?? [])
      .map((item) => ({
        service_type_id: item.service_type_id,
        service_name:
          (item.service_type as { name: string } | null)?.name ?? "Serviço",
        quantity: item.quantity,
      }))
      .sort((a, b) => a.service_name.localeCompare(b.service_name, "pt-BR")),
    subscriber_count: subscribers.get(plan.id) ?? 0,
  }));
}

/** Normaliza uma linha da view: `credits` chega como jsonb. */
function toSubscription(row: {
  credits: unknown;
  [key: string]: unknown;
}): ClubinhoSubscriptionDTO {
  return {
    ...(row as unknown as ClubinhoSubscriptionDTO),
    credits: Array.isArray(row.credits)
      ? (row.credits as ClubinhoCreditDTO[])
      : [],
  };
}

/**
 * Assinaturas do petshop. `openOnly` (o padrão da tela de gestão) deixa de
 * fora as canceladas e encerradas, que só interessam no histórico.
 */
export async function loadClubinhoSubscriptions(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  { openOnly = true }: { openOnly?: boolean } = {},
): Promise<ClubinhoSubscriptionDTO[]> {
  let query = supabase
    .from("clubinho_subscription_view")
    .select(SUBSCRIPTION_SELECT)
    .eq("tenant_id", tenantId);
  if (openOnly) query = query.in("status", ["ACTIVE", "PAUSED"]);

  const { data } = await query.order("pet_name");
  return (data ?? []).map(toSubscription);
}

/**
 * Assinatura aberta de um pet, ou null. É a consulta que a ficha do pet e a
 * finalização do atendimento usam para saber se há saldo a descontar.
 */
export async function loadPetSubscription(
  supabase: SupabaseClient<Database>,
  petId: string,
): Promise<ClubinhoSubscriptionDTO | null> {
  const { data } = await supabase
    .from("clubinho_subscription_view")
    .select(SUBSCRIPTION_SELECT)
    .eq("pet_id", petId)
    .in("status", ["ACTIVE", "PAUSED"])
    .maybeSingle();
  return data ? toSubscription(data) : null;
}

const SCHEDULE_SELECT =
  "id, subscription_id, weekday, start_time, service_type_id, collaborator_id, active, service_type(name), collaborator(full_name)";

/**
 * Os horários fixos das assinaturas informadas, agrupados por assinatura.
 *
 * Recebe a lista de ids em vez de buscar por tenant porque as duas telas que
 * usam isso já carregaram as assinaturas — a da ficha do pet tem uma só.
 */
export async function loadClubinhoSchedules(
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
      collaborator_id: row.collaborator_id,
      collaborator_name:
        (row.collaborator as { full_name: string } | null)?.full_name ??
        "Profissional",
      active: row.active,
    });
    bySubscription.set(row.subscription_id, list);
  }
  return bySubscription;
}

/**
 * As datas do ciclo com o estado de cada uma (agendada, conflito, fora do
 * pacote). A regra vive na RPC de propósito — repetir a conta de orçamento
 * aqui seria pedir para as duas versões divergirem.
 */
export async function loadSchedulePreview(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<ClubinhoOccurrenceDTO[]> {
  const { data, error } = await supabase.rpc("clubinho_schedule_preview", {
    p_subscription: subscriptionId,
  });
  if (error) {
    console.warn(`[clubinho] prévia indisponível: ${error.message}`);
    return [];
  }
  return (data ?? []) as ClubinhoOccurrenceDTO[];
}

/**
 * Tutores que ficaram com o selo do modelo antigo (0038) e nenhum pet
 * assinante. A migração não tem como adivinhar o plano deles, então a tela do
 * Clubinho os lista para o petshop converter — enquanto isso, o selo continua
 * aceso sem saldo nenhum por trás.
 */
export async function loadLegacyClubinhoTutors(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ id: string; full_name: string }[]> {
  const [{ data: flagged }, { data: subs }] = await Promise.all([
    supabase
      .from("tutor")
      .select("id, full_name")
      .eq("tenant_id", tenantId)
      .eq("clubinho", true)
      .order("full_name"),
    supabase
      .from("clubinho_subscription")
      .select("tutor_id, status")
      .eq("tenant_id", tenantId)
      .in("status", ["ACTIVE", "PAUSED"]),
  ]);

  const withSubscription = new Set((subs ?? []).map((s) => s.tutor_id));
  return (flagged ?? []).filter((t) => !withSubscription.has(t.id));
}
