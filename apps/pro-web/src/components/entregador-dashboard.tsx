import { CalendarClock, ChevronDown, PackageCheck } from "lucide-react";
import { Card, EmptyState, PageHeader, StatusChip } from "@mylivepet/ui";
import { WEEKDAY_LABEL, type Weekday } from "@mylivepet/types";
import { EntregadorResumo } from "@/components/entregador-resumo";
import { createClient } from "@/lib/supabase/server";
import {
  hhmm,
  rangesOfDay,
  scheduleByDay,
  type ScheduleRow,
} from "@/lib/collaborator-schedule";
import { agoraSP, carregarDiaDoEntregador, hojePorExtenso } from "@/lib/entregador-dia";
import type { ActiveTenant } from "@/lib/tenant";

/** "2026-09-01" — primeiro dia do mês corrente, para o contador do período. */
function startOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Em que ponto do expediente ele está agora. Calculado no servidor, que já
 * renderiza a cada visita (force-dynamic) — precisão de minuto não faz falta.
 */
function situacaoExpediente(
  faixas: ScheduleRow[],
  agora: string,
): { texto: string; tom: "neutral" | "success" | "brand" } {
  if (!faixas.length) return { texto: "Folga hoje", tom: "neutral" };
  const ordenadas = faixas
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  for (const f of ordenadas) {
    const ini = hhmm(f.start_time);
    const fim = hhmm(f.end_time);
    if (agora < ini) {
      return f === ordenadas[0]
        ? { texto: `Começa às ${ini}`, tom: "neutral" }
        : { texto: `Intervalo · volta às ${ini}`, tom: "brand" };
    }
    if (agora < fim) return { texto: `Em expediente · até ${fim}`, tom: "success" };
  }
  return { texto: "Expediente encerrado", tom: "neutral" };
}

/**
 * Painel do entregador — o resumo do dia, servido na raiz no lugar do painel
 * de gestão (ver (app)/page.tsx). A execução da rota fica em /rota.
 */
export async function EntregadorDashboard({ tenant }: { tenant: ActiveTenant }) {
  const supabase = await createClient();

  const [{ me, rota, dia }, { count: feitasNoMes }] = await Promise.all([
    carregarDiaDoEntregador(supabase),
    supabase
      .from("delivery_stop")
      .select("*", { count: "exact", head: true })
      .eq("status", "DONE")
      .gte("done_at", startOfMonth()),
  ]);

  const byDay = scheduleByDay(me?.collaborator_schedule ?? []);
  const { weekday: hojeWeekday, hhmm: agora } = agoraSP();
  const expediente = situacaoExpediente(byDay.get(hojeWeekday) ?? [], agora);
  const primeiroNome = (me?.full_name ?? "").trim().split(" ")[0];
  const dias = [0, 1, 2, 3, 4, 5, 6].filter((weekday) => byDay.has(weekday));

  const linhaDia = (weekday: number) => {
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
        <span className={hoje ? "text-sm font-medium text-orange" : "text-sm text-graphite"}>
          {WEEKDAY_LABEL[weekday as Weekday]}
        </span>
        <span
          className={
            hoje
              ? "text-right text-sm font-medium tabular-nums text-orange"
              : "text-right text-sm tabular-nums text-gray-neutral"
          }
        >
          {rangesOfDay(byDay.get(weekday) ?? [])}
        </span>
      </li>
    );
  };

  const sidebar = (
    <>
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-graphite">Meu horário</h2>
          {byDay.size > 0 && (
            <StatusChip tone={expediente.tom}>{expediente.texto}</StatusChip>
          )}
        </div>
        {byDay.size === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Sem horários cadastrados"
            description="O petshop ainda não definiu suas faixas de trabalho."
          />
        ) : (
          <>
            {/* Tela larga: a semana inteira, há espaço na coluna lateral. */}
            <ul className="hidden space-y-1.5 lg:block">{dias.map(linhaDia)}</ul>

            {/* Celular/tablet: só hoje aberto, o resto sob demanda. */}
            <div className="lg:hidden">
              {byDay.has(hojeWeekday) ? (
                <ul>{linhaDia(hojeWeekday)}</ul>
              ) : (
                <p className="px-2 py-1 text-sm text-gray-neutral">Hoje não é dia de trabalho.</p>
              )}
              <details className="group mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 px-2 py-1 text-sm font-medium text-petrol [&::-webkit-details-marker]:hidden">
                  Ver a semana
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-1 space-y-1.5">{dias.map(linhaDia)}</ul>
              </details>
            </div>
          </>
        )}
      </Card>

      <Card className="self-start">
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
        title={primeiroNome ? `Olá, ${primeiroNome}` : "Visão geral"}
        subtitle={hojePorExtenso()}
      />
      <EntregadorResumo rota={rota} dia={dia} sidebar={sidebar} />
    </div>
  );
}
