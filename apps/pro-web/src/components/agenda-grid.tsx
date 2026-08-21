"use client";

import { Plus } from "lucide-react";
import { cn } from "@mylivepet/ui";
import { AgendaCard } from "@/components/agenda-card";
import {
  bandLabel,
  byCell,
  cellKey,
  hourLabel,
  parseDayKey,
  shortWeekday,
  weekDays,
} from "@/lib/agenda";
import { dayKey, type AtendimentoRow as Row } from "@/lib/atendimentos";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * A grade da agenda. Linhas são sempre faixas de uma hora; o que muda entre os
 * modos é a coluna — a hora do dia em "Dia", o dia da semana em "Semana".
 *
 * Abaixo de `md` a grade vira uma lista vertical por faixa de horário: sete
 * colunas não cabem num celular, e espremer o card apagaria justamente o pet, o
 * tutor e o profissional, que são o motivo da tela existir.
 */
export function AgendaGrid({
  view,
  date,
  rows,
  hours,
  canBook,
  onPick,
}: {
  view: "dia" | "semana";
  /** Dia visível ("dia") ou qualquer dia da semana visível ("semana"). */
  date: string;
  rows: Row[];
  hours: number[];
  /** VIEWER e colaborador não agendam — a célula vazia deixa de ser botão. */
  canBook: boolean;
  /** Célula vazia clicada: dia "YYYY-MM-DD" e hora cheia. */
  onPick: (day: string, hour: number) => void;
}) {
  const cells = byCell(rows, view);
  const days = view === "semana" ? weekDays(date) : [];
  const columns = view === "semana" ? days : hours;
  const todayKey = dayKey(new Date());

  return (
    <>
      {/* Desktop: a grade */}
      <div className="hidden overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card md:block">
        <div className="overflow-x-auto">
          <div
            className="min-w-max"
            style={{
              display: "grid",
              gridTemplateColumns: `128px repeat(${columns.length}, minmax(148px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 border-b border-graphite/10 bg-surface-muted px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-neutral">
              Horário
            </div>
            {view === "semana"
              ? days.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      "border-b border-l border-graphite/10 bg-surface-muted px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide",
                      day === todayKey ? "text-orange" : "text-gray-neutral",
                    )}
                  >
                    {shortWeekday(day)}{" "}
                    <span className="tabular-nums">
                      {pad(parseDayKey(day).getDate())}/
                      {pad(parseDayKey(day).getMonth() + 1)}
                    </span>
                  </div>
                ))
              : hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b border-l border-graphite/10 bg-surface-muted px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide tabular-nums text-gray-neutral"
                  >
                    {hourLabel(hour)}
                  </div>
                ))}

            {hours.map((band) => (
              <Band
                key={band}
                band={band}
                columns={columns}
                cells={cells}
                day={date}
                canBook={canBook}
                onPick={onPick}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: as mesmas faixas, uma embaixo da outra */}
      <div className="space-y-3 md:hidden">
        {hours.map((band) => {
          const list = columns.flatMap(
            (col) => cells.get(cellKey(col, band)) ?? [],
          );
          return (
            <div key={band}>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="font-heading text-xs font-semibold uppercase tracking-wide text-graphite">
                  {bandLabel(band)}
                </h3>
                <span className="h-px flex-1 bg-graphite/10" />
              </div>
              {list.length === 0 ? (
                canBook ? (
                  <button
                    type="button"
                    onClick={() => onPick(date, band)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-graphite/15 py-3 text-xs text-gray-neutral"
                  >
                    <Plus className="h-3.5 w-3.5" /> Agendar às{" "}
                    {hourLabel(band)}
                  </button>
                ) : (
                  <p className="rounded-xl border border-dashed border-graphite/15 py-3 text-center text-xs text-gray-neutral">
                    Nada agendado
                  </p>
                )
              ) : (
                <div className="space-y-2">
                  {list.map((row) => (
                    <AgendaCard key={row.id} row={row} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function Band({
  band,
  columns,
  cells,
  day,
  canBook,
  onPick,
}: {
  band: number;
  columns: (string | number)[];
  cells: Map<string, Row[]>;
  day: string;
  canBook: boolean;
  onPick: (day: string, hour: number) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-graphite/10 bg-surface px-4 py-3 text-sm font-medium tabular-nums text-gray-neutral">
        {bandLabel(band)}
      </div>
      {columns.map((col) => {
        const list = cells.get(cellKey(col, band)) ?? [];
        // Na visão de semana a coluna já é o dia; na de dia, o dia é fixo e a
        // coluna é a hora que o agendamento vai receber.
        const pickDay = typeof col === "string" ? col : day;
        const pickHour = typeof col === "string" ? band : col;

        return (
          <div
            key={String(col)}
            className="border-b border-l border-graphite/10 p-1.5"
          >
            {list.length > 0 ? (
              <div className="space-y-1.5">
                {list.map((row) => (
                  <AgendaCard key={row.id} row={row} />
                ))}
              </div>
            ) : canBook ? (
              <button
                type="button"
                onClick={() => onPick(pickDay, pickHour)}
                aria-label={`Agendar em ${pickDay} às ${hourLabel(pickHour)}`}
                className="group flex h-full min-h-16 w-full items-center justify-center rounded-xl text-gray-neutral/0 transition-colors hover:bg-orange/5 hover:text-orange"
              >
                <Plus className="h-4 w-4" />
              </button>
            ) : (
              <div className="min-h-16" />
            )}
          </div>
        );
      })}
    </>
  );
}
