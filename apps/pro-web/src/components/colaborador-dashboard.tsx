import { CalendarClock, ClipboardCheck, Star } from "lucide-react";
import { Card, EmptyState, PageHeader, RatingStars } from "@mylivepet/ui";
import {
  WEEKDAY_LABEL,
  formatBehaviorScore,
  type Weekday,
} from "@mylivepet/types";
import { ColaboradorDia } from "@/components/colaborador-dia";
import { createClient } from "@/lib/supabase/server";
import { fetchAtendimentos } from "@/lib/atendimentos";
import { fetchBehaviorCategories } from "@/lib/behavior";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import { rangesOfDay, scheduleByDay } from "@/lib/collaborator-schedule";
import type { ActiveTenant } from "@/lib/tenant";

/** "2026-08-01" — primeiro dia do mês corrente, para o contador do período. */
function startOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Dashboard do colaborador — o "meu dia", servido na raiz no lugar do painel
 * de gestão (ver (app)/page.tsx).
 *
 * Nenhuma query precisa filtrar por colaborador: a RLS de 0031 já entrega só
 * os atendimentos atribuídos a ele, o próprio cadastro e os boletins que ele
 * mesmo escreveu.
 */
export async function ColaboradorDashboard({
  tenant,
}: {
  tenant: ActiveTenant;
}) {
  const supabase = await createClient();

  const [
    rows,
    { data: me },
    { count: doneThisMonth },
    { data: scores },
    { data: cameras },
    behaviorCategories,
    terminals,
  ] = await Promise.all([
    fetchAtendimentos(supabase),
    supabase
      .from("collaborator")
      .select(
        "id, full_name, role_title, collaborator_schedule(weekday, start_time, end_time)",
      )
      .maybeSingle(),
    supabase
      .from("appointment")
      .select("*", { count: "exact", head: true })
      .eq("status", "COMPLETED")
      .gte("finished_at", startOfMonth()),
    supabase
      .from("pet_behavior_report")
      .select("overall_score")
      .not("overall_score", "is", null),
    supabase
      .from("camera")
      .select("id, room_label")
      .eq("active", true)
      .order("room_label"),
    fetchBehaviorCategories(supabase, tenant.tenantId),
    loadPaymentTerminals(supabase, tenant.tenantId, { activeOnly: true }),
  ]);

  const notas = (scores ?? [])
    .map((s) => Number(s.overall_score))
    .filter((n) => Number.isFinite(n));
  const mediaBoletim =
    notas.length > 0 ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  const schedules = me?.collaborator_schedule ?? [];
  const byDay = scheduleByDay(schedules);
  const hojeWeekday = new Date().getDay();

  const primeiroNome = (me?.full_name ?? "").trim().split(" ")[0];
  const hojePorExtenso = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
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
                        hoje
                          ? "text-sm font-medium text-orange"
                          : "text-sm text-graphite"
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
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-bold tabular-nums text-graphite">
              {doneThisMonth ?? 0}
            </p>
            <p className="text-xs text-gray-neutral">
              atendimentos concluídos no mês
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-[#8a6418]">
            <Star className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {mediaBoletim === null ? (
              <>
                <p className="font-heading text-lg font-semibold text-graphite">
                  —
                </p>
                <p className="text-xs text-gray-neutral">
                  você ainda não preencheu boletins
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <RatingStars value={Math.round(mediaBoletim)} size="sm" />
                  <span className="font-heading text-lg font-semibold tabular-nums text-graphite">
                    {formatBehaviorScore(mediaBoletim)}
                  </span>
                </div>
                <p className="text-xs text-gray-neutral">
                  média dos boletins que você deu ({notas.length})
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    </>
  );

  return (
    <div>
      <PageHeader
        title={primeiroNome ? `Olá, ${primeiroNome}` : "Meu dia"}
        subtitle={hojePorExtenso}
      />
      <ColaboradorDia
        initial={rows}
        cameras={cameras ?? []}
        behaviorCategories={behaviorCategories}
        terminals={terminals}
        sidebar={sidebar}
      />
    </div>
  );
}
