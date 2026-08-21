import Link from "next/link";
import { ChevronRight, Crown, Info, Repeat, Scissors } from "lucide-react";
import { Card, EmptyState, PageHeader, StatusChip } from "@mylivepet/ui";
import {
  CLUBINHO_CYCLE_EVERY,
  canMutateAsRole,
  clubinhoCycleLabel,
  formatBRL,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { loadClubinhoPlans } from "@/lib/clubinho";
import { PlanDialog, type ServiceOption } from "./plan-dialog";
import { DeletePlanDialog } from "./delete-plan-dialog";

export default async function ClubinhoPlanosPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;

  const [plans, { data: services }] = await Promise.all([
    loadClubinhoPlans(supabase, tenant.tenantId),
    supabase
      .from("service_type")
      .select("id, name, price_cents")
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("name"),
  ]);

  const catalog = (services ?? []) as ServiceOption[];
  const canManage = canMutateAsRole(tenant.role);

  return (
    <div>
      <PageHeader
        title="Planos do Clubinho"
        subtitle="Os pacotes recorrentes que o petshop vende: quanto custam, de quanto em quanto tempo renovam e quantos serviços entregam."
        actions={
          canManage && catalog.length > 0 ? (
            <PlanDialog services={catalog} />
          ) : undefined
        }
      />

      <div className="space-y-6">
        <Card className="border-orange/30 bg-orange/5">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-orange" />
            <div className="space-y-1 text-sm text-graphite">
              <p>
                A <strong>renovação</strong> é o intervalo de cobrança, não a
                frequência das idas ao banho. O clubinho quinzenal que se vende
                no balcão — banho a cada 15 dias — é um plano{" "}
                <strong>mensal com 2 banhos</strong>; o semanal é um mensal com
                4.
              </p>
              <p className="text-gray-neutral">
                A cada renovação o saldo volta a encher e a mensalidade entra
                como receita no Financeiro. O atendimento pago com o pacote não
                gera cobrança nova.
              </p>
            </div>
          </div>
        </Card>

        {catalog.length === 0 ? (
          <EmptyState
            icon={<Scissors className="h-6 w-6" />}
            title="Cadastre um serviço primeiro"
            description="O plano é montado a partir do catálogo: sem serviço ativo não há o que colocar no pacote."
            action={
              <Link
                href="/servicos"
                className="inline-flex items-center gap-1 text-sm font-medium text-orange"
              >
                Ir para Serviços <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
        ) : plans.length === 0 ? (
          <EmptyState
            icon={<Crown className="h-6 w-6" />}
            title="Nenhum plano cadastrado"
            description="Crie o primeiro pacote — os modelos mensal (4 banhos) e quinzenal (2 banhos) já vêm prontos para ajustar."
            action={canManage ? <PlanDialog services={catalog} /> : undefined}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <Card key={plan.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3 border-b border-graphite/5 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Crown className="h-4 w-4 shrink-0 text-petrol" />
                      <p className="font-heading font-semibold text-graphite">
                        {plan.name}
                      </p>
                      {!plan.active && (
                        <StatusChip tone="danger">Fora de venda</StatusChip>
                      )}
                      {plan.rollover && (
                        <StatusChip tone="neutral">Acumula</StatusChip>
                      )}
                    </div>
                    {plan.description && (
                      <p className="mt-1 text-sm text-gray-neutral">
                        {plan.description}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <PlanDialog plan={plan} services={catalog} />
                      <DeletePlanDialog
                        planId={plan.id}
                        name={plan.name}
                        subscriberCount={plan.subscriber_count}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-4">
                  <span className="font-heading text-2xl font-semibold text-graphite">
                    {formatBRL(plan.price_cents)}
                  </span>
                  <span className="text-sm text-gray-neutral">
                    por {CLUBINHO_CYCLE_EVERY[plan.cycle]}
                  </span>
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-neutral">
                  <Repeat className="h-3.5 w-3.5" />
                  {clubinhoCycleLabel(plan.cycle, plan.cycle_days)}
                  {plan.subscriber_count > 0 && (
                    <>
                      {" · "}
                      {plan.subscriber_count} pet
                      {plan.subscriber_count > 1 ? "s assinam" : " assina"}
                    </>
                  )}
                </p>

                <ul className="mt-4 space-y-1.5 border-t border-graphite/5 pt-4">
                  {plan.items.map((item) => (
                    <li
                      key={item.service_type_id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 truncate text-graphite">
                        {item.service_name}
                      </span>
                      <span className="shrink-0 rounded-full bg-petrol/10 px-2 py-0.5 text-xs font-semibold text-petrol">
                        {item.quantity}x por ciclo
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-heading font-semibold text-graphite">
                Quem assina
              </p>
              <p className="text-sm text-gray-neutral">
                Adesões, saldo de cada pet e renovações ficam na tela do
                Clubinho.
              </p>
            </div>
            <Link
              href="/clubinho"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-orange"
            >
              Abrir <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
