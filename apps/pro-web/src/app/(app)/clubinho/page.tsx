import Link from "next/link";
import { AlertTriangle, ChevronRight, Crown, Repeat, Wallet } from "lucide-react";
import {
  Avatar,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatusChip,
} from "@mylivepet/ui";
import {
  CLUBINHO_STATUS_LABEL,
  canMutateAsRole,
  clubinhoCycleLabel,
  formatBRL,
  type ClubinhoSubscriptionDTO,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import { loadBookingOptions } from "@/lib/booking-options";
import {
  loadClubinhoPlans,
  loadClubinhoSchedules,
  loadClubinhoSubscriptions,
  loadLegacyClubinhoTutors,
  loadSchedulePreview,
  syncClubinho,
} from "@/lib/clubinho";
import { ClubinhoBalance } from "@/components/clubinho-balance";
import { ClubinhoScheduleList } from "@/components/clubinho-schedule-list";
import { ClubinhoScheduleDialog } from "@/components/clubinho-schedule-dialog";
import {
  ClubinhoSubscriptionDialog,
  type PetOption,
} from "@/components/clubinho-subscription-dialog";
import { ClubinhoStatusActions } from "@/components/clubinho-status-actions";

/**
 * Quanto o pacote rende por mês, para os ciclos caberem numa métrica só.
 * É estimativa de vitrine, não contabilidade: quem fecha o mês é o Financeiro,
 * com as mensalidades efetivamente lançadas.
 */
function monthlyCents(sub: ClubinhoSubscriptionDTO): number {
  const perMonth: Record<string, number> = {
    WEEKLY: 30 / 7,
    BIWEEKLY: 2,
    MONTHLY: 1,
    BIMONTHLY: 1 / 2,
    QUARTERLY: 1 / 3,
    SEMIANNUAL: 1 / 6,
    ANNUAL: 1 / 12,
  };
  const factor =
    sub.plan_cycle === "CUSTOM"
      ? 30 / Math.max(sub.plan_cycle_days ?? 30, 1)
      : (perMonth[sub.plan_cycle] ?? 1);
  return Math.round(sub.price_cents * factor);
}

export default async function ClubinhoPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;

  // Renova os ciclos vencidos e materializa os horários fixos antes de
  // mostrar qualquer coisa: sem cron, é aqui que a rotina acontece
  // (ver syncClubinho).
  await syncClubinho(supabase, tenant.tenantId);

  const [
    subscriptions,
    plans,
    terminals,
    legacyTutors,
    bookingOptions,
    { data: petRows },
  ] = await Promise.all([
    loadClubinhoSubscriptions(supabase, tenant.tenantId),
    loadClubinhoPlans(supabase, tenant.tenantId, { activeOnly: true }),
    loadPaymentTerminals(supabase, tenant.tenantId, { activeOnly: true }),
    loadLegacyClubinhoTutors(supabase, tenant.tenantId),
    // Só os profissionais interessam aqui; o pet e o serviço já vêm da
    // assinatura.
    loadBookingOptions(supabase, { includeTutors: false }),
    supabase
      .from("pet")
      .select("id, name, tutor(full_name)")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
  ]);

  // Combinados de todas as assinaturas numa consulta; a prévia é por
  // assinatura (a regra de orçamento é por ciclo) e roda em paralelo.
  const schedulesBySubscription = await loadClubinhoSchedules(
    supabase,
    subscriptions.map((s) => s.id),
  );
  const previews = new Map(
    await Promise.all(
      subscriptions
        .filter((s) => schedulesBySubscription.has(s.id))
        .map(
          async (s) =>
            [s.id, await loadSchedulePreview(supabase, s.id)] as const,
        ),
    ),
  );

  const canManage = canMutateAsRole(tenant.role);
  const taken = new Set(subscriptions.map((s) => s.pet_id));
  const availablePets: PetOption[] = (petRows ?? [])
    .filter((pet) => !taken.has(pet.id))
    .map((pet) => ({
      id: pet.id,
      name: pet.name,
      tutor_name:
        (pet.tutor as { full_name: string } | null)?.full_name ?? "Sem tutor",
    }));

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const recurringCents = active.reduce((sum, s) => sum + monthlyCents(s), 0);
  const creditsLeft = active.reduce((sum, s) => sum + s.credits_left, 0);

  const newSubscription = canManage ? (
    <ClubinhoSubscriptionDialog
      plans={plans}
      pets={availablePets}
      terminals={terminals}
    />
  ) : undefined;

  return (
    <div>
      <PageHeader
        title="Clubinho"
        subtitle="Quem assina, quanto ainda tem de saldo e quando renova."
        actions={plans.length > 0 ? newSubscription : undefined}
      />

      {plans.length === 0 ? (
        <EmptyState
          icon={<Crown className="h-6 w-6" />}
          title="Crie um plano primeiro"
          description="O Clubinho começa pelo pacote: quanto custa, de quanto em quanto tempo renova e quantos banhos entrega. Só depois um pet pode assinar."
          action={
            <Link
              href="/configuracoes/clubinho"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange"
            >
              Criar plano em Configurações <ChevronRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Assinaturas ativas"
              value={active.length}
              hint={
                subscriptions.length > active.length
                  ? `${subscriptions.length - active.length} pausada(s)`
                  : "pets no pacote"
              }
              icon={<Crown className="h-5 w-5" />}
              accent="#1D4E5F"
            />
            <StatCard
              label="Recorrente por mês"
              value={formatBRL(recurringCents)}
              hint="estimativa dos ciclos ativos"
              icon={<Wallet className="h-5 w-5" />}
              accent="#FF6A00"
            />
            <StatCard
              label="Serviços a entregar"
              value={creditsLeft}
              hint="saldo somado do ciclo atual"
              icon={<Repeat className="h-5 w-5" />}
              accent="#2E7D5B"
            />
          </div>

          {legacyTutors.length > 0 && (
            <Card className="border-warning/40 bg-warning/5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div className="space-y-1 text-sm text-graphite">
                  <p>
                    {legacyTutors.length} tutor
                    {legacyTutors.length > 1 ? "es continuam" : " continua"} com
                    o selo do Clubinho antigo, quando ele era só um sim/não no
                    cadastro — e nenhum pet dele
                    {legacyTutors.length > 1 ? "s" : ""} tem assinatura, então
                    não há saldo nenhum por trás do selo.
                  </p>
                  <p className="text-gray-neutral">
                    {legacyTutors
                      .slice(0, 8)
                      .map((t) => t.full_name)
                      .join(", ")}
                    {legacyTutors.length > 8 &&
                      ` e mais ${legacyTutors.length - 8}`}
                    . Crie a assinatura do pet certo — o selo se acerta sozinho.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {subscriptions.length === 0 ? (
            <EmptyState
              icon={<Crown className="h-6 w-6" />}
              title="Nenhum pet no Clubinho ainda"
              description="Escolha o pet e o plano. A assinatura é por pet: um tutor pode ter um cão no pacote e o outro fora."
              action={newSubscription}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {subscriptions.map((sub) => (
                <Card key={sub.id} className="flex flex-col">
                  <div className="flex items-start gap-3 border-b border-graphite/5 pb-4">
                    <Avatar
                      name={sub.pet_name}
                      src={sub.pet_photo_path}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/pets/${sub.pet_id}`}
                          className="truncate font-heading font-semibold text-graphite hover:text-orange"
                        >
                          {sub.pet_name}
                        </Link>
                        {sub.status !== "ACTIVE" && (
                          <StatusChip tone="warning">
                            {CLUBINHO_STATUS_LABEL[sub.status]}
                          </StatusChip>
                        )}
                      </div>
                      <p className="truncate text-sm text-gray-neutral">
                        {sub.tutor_name}
                      </p>
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 items-center">
                        <ClubinhoSubscriptionDialog
                          subscription={sub}
                          plans={plans}
                          terminals={terminals}
                        />
                        <ClubinhoStatusActions subscription={sub} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-graphite">
                      <Crown className="h-4 w-4 text-petrol" />
                      {sub.plan_name}
                    </span>
                    <span className="text-sm text-gray-neutral">
                      {formatBRL(sub.price_cents)} ·{" "}
                      {clubinhoCycleLabel(sub.plan_cycle, sub.plan_cycle_days)}
                    </span>
                  </div>

                  <ClubinhoBalance
                    subscription={sub}
                    className="border-t border-graphite/5 pt-3"
                  />

                  <ClubinhoScheduleList
                    schedules={schedulesBySubscription.get(sub.id) ?? []}
                    occurrences={previews.get(sub.id) ?? []}
                    petId={sub.pet_id}
                    canManage={canManage && sub.status === "ACTIVE"}
                    className="mt-3 border-t border-graphite/5 pt-3"
                  >
                    <ClubinhoScheduleDialog
                      subscription={sub}
                      collaborators={bookingOptions.collaborators}
                    />
                  </ClubinhoScheduleList>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
