"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Avatar, cn } from "@mylivepet/ui";
import { AgendaCard } from "@/components/agenda-card";
import {
  bandLabel,
  byCell,
  cellKey,
  hourLabel,
  parseDayKey,
  shortWeekday,
  weekDays,
  NO_COLLABORATOR,
  type DayColumn,
} from "@/lib/agenda";
import { dayKey, type AtendimentoRow as Row } from "@/lib/atendimentos";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Quantos atendimentos uma célula mostra antes de resumir o resto num botão.
 * Três cards compactos deixam a faixa de uma hora em ~150px; a partir daí a
 * linha inteira da grade começa a ser lida pela célula mais cheia do dia.
 */
const MAX_VISIBLE = 3;

/**
 * Uma coluna da grade, já resolvida: a chave que casa com o mapa de células, o
 * cabeçalho e o que uma célula vazia agenda.
 */
type GridColumn = {
  key: string;
  header: React.ReactNode;
  /** Dia que a célula vazia desta coluna agenda. */
  pickDay: string;
  /** Profissional já escolhido pela coluna (visão de Dia). */
  collaboratorId?: string;
  /** "Sem profissional" não agenda: escolher alguém é obrigatório. */
  bookable: boolean;
};

/**
 * A grade da agenda. Linhas são sempre faixas de uma hora; o que muda entre os
 * modos é a coluna — o profissional em "Dia", o dia da semana em "Semana".
 *
 * A hora aparece só na lateral: quando ela era também a coluna do modo Dia, o
 * mesmo dado ficava nos dois eixos e só a diagonal da grade tinha conteúdo.
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
  collaboratorColumns,
  canBook,
  onPick,
}: {
  view: "dia" | "semana";
  /** Dia visível ("dia") ou qualquer dia da semana visível ("semana"). */
  date: string;
  rows: Row[];
  hours: number[];
  /** Colunas da visão de Dia — os profissionais que trabalham no dia. */
  collaboratorColumns: DayColumn[];
  /** VIEWER e colaborador não agendam — a célula vazia deixa de ser botão. */
  canBook: boolean;
  /** Célula vazia clicada: dia "YYYY-MM-DD", hora cheia e profissional. */
  onPick: (day: string, hour: number, collaboratorId?: string) => void;
}) {
  const cells = byCell(rows, view);
  const todayKey = dayKey(new Date());

  const columns: GridColumn[] =
    view === "semana"
      ? weekDays(date).map((day) => ({
          key: day,
          pickDay: day,
          bookable: true,
          header: (
            <span
              className={cn(
                "text-xs font-semibold uppercase tracking-wide",
                day === todayKey ? "text-orange" : "text-gray-neutral",
              )}
            >
              {shortWeekday(day)}{" "}
              <span className="tabular-nums">
                {pad(parseDayKey(day).getDate())}/
                {pad(parseDayKey(day).getMonth() + 1)}
              </span>
            </span>
          ),
        }))
      : collaboratorColumns.map((col) => {
          const orphan = col.id === NO_COLLABORATOR;
          return {
            key: col.id,
            pickDay: date,
            collaboratorId: orphan ? undefined : col.id,
            bookable: !orphan,
            header: orphan ? (
              <span className="text-xs font-medium italic text-gray-neutral">
                {col.name}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Avatar
                  name={col.name}
                  size="sm"
                  className="h-6 w-6 shrink-0 text-[10px]"
                />
                <span className="min-w-0 text-left">
                  <span className="block truncate font-heading text-xs font-semibold text-graphite">
                    {col.name}
                  </span>
                  {col.roleTitle && (
                    <span className="block truncate text-[11px] font-normal text-gray-neutral">
                      {col.roleTitle}
                    </span>
                  )}
                </span>
              </span>
            ),
          };
        });

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
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center justify-center border-b border-l border-graphite/10 bg-surface-muted px-3 py-2.5 text-center"
              >
                {col.header}
              </div>
            ))}

            {hours.map((band) => (
              <Band
                key={band}
                band={band}
                columns={columns}
                cells={cells}
                showCollaborator={view === "semana"}
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
            (col) => cells.get(cellKey(col.key, band)) ?? [],
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
  showCollaborator,
  canBook,
  onPick,
}: {
  band: number;
  columns: GridColumn[];
  cells: Map<string, Row[]>;
  /** No modo Dia a coluna já diz o profissional — repetir no card é ruído. */
  showCollaborator: boolean;
  canBook: boolean;
  onPick: (day: string, hour: number, collaboratorId?: string) => void;
}) {
  return (
    <>
      <div className="sticky left-0 z-10 border-b border-graphite/10 bg-surface px-4 py-3 text-sm font-medium tabular-nums text-gray-neutral">
        {bandLabel(band)}
      </div>
      {columns.map((col) => (
        // O dia entra na chave para o "ver mais" de uma célula não seguir
        // aberto ao virar o dia ou a semana, onde os atendimentos são outros.
        <Cell
          key={`${col.pickDay}|${col.key}`}
          col={col}
          band={band}
          list={cells.get(cellKey(col.key, band)) ?? []}
          showCollaborator={showCollaborator}
          canBook={canBook}
          onPick={onPick}
        />
      ))}
    </>
  );
}

/**
 * Uma célula da grade: a faixa de uma hora numa coluna.
 *
 * Sozinho, o atendimento aparece no card inteiro. A partir do segundo todos
 * viram cards compactos numa pilha só — dois cards inteiros empilhados
 * esticavam a linha para quase 300px e deixavam as outras colunas do dia num
 * vazio da mesma altura. Passando de três, o resto fica atrás de um botão, que
 * abre a célula sem tirar ninguém da tela.
 */
function Cell({
  col,
  band,
  list,
  showCollaborator,
  canBook,
  onPick,
}: {
  col: GridColumn;
  band: number;
  list: Row[];
  showCollaborator: boolean;
  canBook: boolean;
  onPick: (day: string, hour: number, collaboratorId?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const cell = "border-b border-l border-graphite/10 p-1.5";

  if (list.length === 0) {
    return (
      <div className={cell}>
        {canBook && col.bookable ? (
          <button
            type="button"
            onClick={() => onPick(col.pickDay, band, col.collaboratorId)}
            aria-label={`Agendar em ${col.pickDay} às ${hourLabel(band)}`}
            className="group flex h-full min-h-16 w-full items-center justify-center rounded-xl text-gray-neutral/0 transition-colors hover:bg-orange/5 hover:text-orange"
          >
            <Plus className="h-4 w-4" />
          </button>
        ) : (
          <div className="min-h-16" />
        )}
      </div>
    );
  }

  if (list.length === 1) {
    return (
      <div className={cell}>
        <AgendaCard row={list[0]!} showCollaborator={showCollaborator} />
      </div>
    );
  }

  const hidden = expanded ? 0 : Math.max(0, list.length - MAX_VISIBLE);
  const visible = hidden > 0 ? list.slice(0, MAX_VISIBLE) : list;

  return (
    <div className={cell}>
      <div className="divide-y divide-graphite/10 overflow-hidden rounded-xl border border-graphite/10 shadow-card">
        {visible.map((row) => (
          <AgendaCard
            key={row.id}
            row={row}
            showCollaborator={showCollaborator}
            compact
          />
        ))}
        {(hidden > 0 || expanded) && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full bg-surface px-2 py-1.5 text-center text-[11px] font-medium text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite"
          >
            {hidden > 0
              ? `+ ${hidden} ${hidden === 1 ? "atendimento" : "atendimentos"}`
              : "Mostrar menos"}
          </button>
        )}
      </div>
    </div>
  );
}
