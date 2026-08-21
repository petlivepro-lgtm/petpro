"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Card, DatePicker, EmptyState } from "@mylivepet/ui";
import type { BehaviorCategory, PaymentTerminalDTO } from "@mylivepet/types";
import { AtendimentoRow } from "@/components/atendimento-row";
import type { CameraOption } from "@/components/start-appointment-dialog";
import {
  dayKey,
  groupByDay,
  type AtendimentoRow as Row,
} from "@/lib/atendimentos";

/**
 * O histórico em lista, do mais recente para o mais antigo, com o intervalo de
 * datas em vez da navegação dia a dia do calendário.
 *
 * A grade responde "como está a agenda"; para "o que aconteceu com esse pet no
 * mês passado" a lista continua sendo o formato certo, então ela sobreviveu à
 * troca de layout como um terceiro modo da mesma tela.
 */
export function AgendaHistorico({
  rows,
  cameras,
  behaviorCategories,
  terminals,
  dateFrom,
  dateTo,
  onDateChange,
  canConfirm,
  hasFilter,
}: {
  rows: Row[];
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  terminals: PaymentTerminalDTO[];
  dateFrom?: string;
  dateTo?: string;
  onDateChange: (key: "from" | "to", value: string) => void;
  canConfirm: boolean;
  /** Muda o texto do vazio: filtrar demais não é o mesmo que não ter nada. */
  hasFilter: boolean;
}) {
  const todayKey = dayKey(new Date());
  const groups = useMemo(
    () => groupByDay(rows, "desc", todayKey),
    [rows, todayKey],
  );

  return (
    <div>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="w-full sm:w-44">
          <label
            htmlFor="historico-from"
            className="mb-1.5 block text-xs font-medium text-gray-neutral"
          >
            De
          </label>
          <DatePicker
            id="historico-from"
            mode="date"
            value={dateFrom ?? ""}
            max={dateTo}
            onChange={(value) => onDateChange("from", value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <label
            htmlFor="historico-to"
            className="mb-1.5 block text-xs font-medium text-gray-neutral"
          >
            Até
          </label>
          <DatePicker
            id="historico-to"
            mode="date"
            value={dateTo ?? ""}
            min={dateFrom}
            onChange={(value) => onDateChange("to", value)}
          />
        </div>
        <p className="text-xs text-gray-neutral sm:ml-auto sm:pb-3">
          Sem intervalo, os 100 atendimentos mais recentes.
        </p>
      </Card>

      <div className="mt-4 space-y-6">
        {groups.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title={
              hasFilter
                ? "Nenhum atendimento encontrado"
                : "Nenhum atendimento anterior"
            }
            description={
              hasFilter
                ? "Ajuste a busca, os filtros ou o intervalo de datas."
                : "Atendimentos já realizados, recusados ou cancelados ficam neste histórico."
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-surface-muted/95 px-1 py-1.5 backdrop-blur">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-graphite">
                  {group.label}
                </h2>
                <span className="text-xs text-gray-neutral">
                  {group.rows.length}{" "}
                  {group.rows.length === 1 ? "atendimento" : "atendimentos"}
                </span>
              </div>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <AtendimentoRow
                    key={row.id}
                    row={row}
                    cameras={cameras}
                    behaviorCategories={behaviorCategories}
                    terminals={terminals}
                    canConfirm={canConfirm}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
