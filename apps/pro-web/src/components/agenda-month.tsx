"use client";

import Link from "next/link";
import { cn } from "@mylivepet/ui";
import { serviceColor } from "@/lib/agenda-colors";
import { byDay, isSameMonth, monthGridDays, parseDayKey } from "@/lib/agenda";
import { dayKey, formatTime, type AtendimentoRow as Row } from "@/lib/atendimentos";

/** Quantos atendimentos cabem numa célula antes do "+N". */
const MAX_VISIBLE = 3;

const WEEKDAY_HEADS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * A visão de mês: 7 colunas por 5 ou 6 semanas, cada célula um dia inteiro.
 *
 * Não reusa a grade de Dia/Semana de propósito. Lá a linha é uma faixa de uma
 * hora, o que num mês daria trinta e poucos dias vezes dez faixas — uma parede
 * rolável que não responde "como está o meu mês". Aqui a pergunta é outra: em
 * que dias tem movimento, e quanto.
 *
 * Por isso a célula resume em vez de mostrar o card: bolinha na cor do
 * serviço, hora e nome do pet. O card completo continua a um clique de
 * distância, na ficha do atendimento.
 */
export function AgendaMonth({
  date,
  rows,
  onOpenDay,
}: {
  /** Qualquer dia do mês visível, "YYYY-MM-DD". */
  date: string;
  rows: Row[];
  /** Clique no dia (fora de um atendimento): abre aquele dia no modo Dia. */
  onOpenDay: (day: string) => void;
}) {
  const days = monthGridDays(date);
  const cells = byDay(rows);
  const todayKey = dayKey(new Date());

  return (
    <div className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
      <div className="grid grid-cols-7">
        {WEEKDAY_HEADS.map((label) => (
          <div
            key={label}
            className="border-b border-graphite/10 bg-surface-muted px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-neutral"
          >
            {/* No celular só a inicial cabe sem quebrar a coluna. */}
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}

        {days.map((day) => (
          <DayCell
            key={day}
            day={day}
            rows={cells.get(day) ?? []}
            outside={!isSameMonth(day, date)}
            today={day === todayKey}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </div>
  );
}

function DayCell({
  day,
  rows,
  outside,
  today,
  onOpenDay,
}: {
  day: string;
  rows: Row[];
  /** Sobra da semana vizinha: aparece apagado, mas continua clicável. */
  outside: boolean;
  today: boolean;
  onOpenDay: (day: string) => void;
}) {
  const visible = rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;

  return (
    <div
      className={cn(
        "min-h-24 border-b border-l border-graphite/10 p-1 first:border-l-0 sm:min-h-32 sm:p-1.5",
        outside && "bg-surface-muted/40",
      )}
    >
      {/* O dia inteiro é o alvo do clique — abrir o dia é a ação padrão da
          célula, e os atendimentos são links por cima dela. */}
      <button
        type="button"
        onClick={() => onOpenDay(day)}
        aria-label={`Abrir ${day}`}
        className="mb-1 flex w-full items-center justify-between rounded-lg px-1 py-0.5 transition-colors hover:bg-orange/5"
      >
        <span
          className={cn(
            "font-heading text-xs font-semibold tabular-nums sm:text-sm",
            today && "text-orange",
            outside ? "text-gray-neutral/60" : "text-graphite",
          )}
        >
          {parseDayKey(day).getDate()}
        </span>
        {rows.length > 0 && (
          <span className="text-[10px] tabular-nums text-gray-neutral sm:text-xs">
            {rows.length}
          </span>
        )}
      </button>

      {/* Celular: só as bolinhas. Sete colunas de texto não cabem, e espremer
          apagaria justamente o nome do pet. */}
      <div className="flex flex-wrap gap-1 px-1 sm:hidden">
        {visible.map((row) => (
          <span
            key={row.id}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: serviceColor(row.serviceId, row.serviceColorHex) }}
          />
        ))}
      </div>

      <div className="hidden space-y-0.5 sm:block">
        {visible.map((row) => (
          <Link
            key={row.id}
            href={`/atendimentos/${row.id}`}
            title={[
              formatTime(row.scheduledAt),
              row.petName,
              row.tutorName,
              row.serviceName,
            ]
              .filter(Boolean)
              .join(" · ")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-1 py-0.5 text-xs transition-colors hover:bg-surface-muted",
              (row.status === "CANCELLED" || row.status === "REJECTED") &&
                "opacity-50",
            )}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: serviceColor(row.serviceId, row.serviceColorHex),
              }}
            />
            <span className="shrink-0 tabular-nums text-gray-neutral">
              {formatTime(row.scheduledAt)}
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-graphite",
                (row.status === "CANCELLED" || row.status === "REJECTED") &&
                  "line-through",
              )}
            >
              {row.petName}
            </span>
          </Link>
        ))}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => onOpenDay(day)}
            className="w-full rounded-md px-1 py-0.5 text-left text-xs font-medium text-orange hover:underline"
          >
            +{hidden} {hidden === 1 ? "atendimento" : "atendimentos"}
          </button>
        )}
      </div>
    </div>
  );
}
