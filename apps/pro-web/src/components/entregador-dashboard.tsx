import { CalendarClock, PackageCheck } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@mylivepet/ui";
import { WEEKDAY_LABEL, type Weekday } from "@mylivepet/types";
import { EntregadorRota } from "@/components/entregador-rota";
import { createClient } from "@/lib/supabase/server";
import { rangesOfDay, scheduleByDay } from "@/lib/collaborator-schedule";
import { fetchRota, hojeKey } from "@/lib/rotas";
import type { ActiveTenant } from "@/lib/tenant";

/** "2026-09-01" — primeiro dia do mês corrente, para o contador do período. */
function startOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Painel do entregador — a rota do dia, servida na raiz no lugar do painel de
 * gestão (ver (app)/page.tsx).
 *
 * Nenhuma query filtra por colaborador: a RLS da 0062 já entrega só a rota
 * dele, as paradas dela e o cadastro dele — mesmo arranjo do painel do
 * colaborador que atende.
 */
export async function EntregadorDashboard({ tenant }: { tenant: ActiveTenant }) {
  const supabase = await createClient();
  const dia = hojeKey();

  const { data: me } = await supabase
    .from("collaborator")
    .select("id, full_name, role_title, collaborator_schedule(weekday, start_time, end_time)")
    .maybeSingle();

  // Monta a rota do dia ao abrir o painel. É a "auto-rota": o petshop marca
  // buscar/devolver no agendamento e ninguém precisa montar lista nenhuma à
  // mão. A RPC é idempotente de propósito — chamar a cada visita recalcula o
  // que ainda está pendente e não toca no que já aconteceu.
  if (me) {
    await supabase.rpc("build_delivery_route", { _collaborator: me.id, _date: dia });
  }

  const [rota, { count: feitasNoMes }] = await Promise.all([
    fetchRota(supabase, dia),
    supabase
      .from("delivery_stop")
      .select("*", { count: "exact", head: true })
      .eq("status", "DONE")
      .gte("done_at", startOfMonth()),
  ]);

  const byDay = scheduleByDay(me?.collaborator_schedule ?? []);
  const hojeWeekday = new Date().getDay();
  const primeiroNome = (me?.full_name ?? "").trim().split(" ")[0];
  const hojePorExtenso = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });

  const sidebar = (
    <>
      <Card>
        <h2 className="mb-3 font-heading text-base font-semibold text-graphite">
          Meu horário
        </h2>
        {byDay.size === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Sem horários cadastrados"
            description="O petshop ainda não definiu suas faixas de trabalho."
          />
        ) : (
          <ul className="space-y-1.5">
            {[0, 1, 2, 3, 4, 5, 6]
              .filter((weekday) => byDay.has(weekday))
              .map((weekday) => {
                const hoje = weekday === hojeWeekday;
                return (
                  <li
                    key={weekday}
                    className={
                      hoje
                        ? "flex items-baseline justify-between gap-2 rounded-lg bg-orange/10 px-2 py-1"
                        : "flex items-baseline justify-between gap-2 px-2 py-1"
                    }
                  >
                    <span
                      className={
                        hoje ? "text-sm font-medium text-orange" : "text-sm text-graphite"
                      }
                    >
                      {WEEKDAY_LABEL[weekday as Weekday]}
                    </span>
                    <span
                      className={
                        hoje
                          ? "text-sm font-medium tabular-nums text-orange"
                          : "text-sm tabular-nums text-gray-neutral"
                      }
                    >
                      {rangesOfDay(byDay.get(weekday) ?? [])}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-petrol/10 text-petrol">
            <PackageCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums text-graphite">
              {feitasNoMes ?? 0}
            </p>
            <p className="text-xs text-gray-neutral">paradas concluídas no mês</p>
          </div>
        </div>
      </Card>
    </>
  );

  return (
    <div>
      <PageHeader
        title={primeiroNome ? `Olá, ${primeiroNome}` : "Minha rota"}
        subtitle={hojePorExtenso}
      />
      <EntregadorRota rota={rota} dia={dia} sidebar={sidebar} />
    </div>
  );
}
