"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, DatePicker, cn } from "@mylivepet/ui";
import {
  formatDayHeading,
  formatMonthHeading,
  formatWeekHeading,
  type AgendaView as ViewMode,
} from "@/lib/agenda";
import { dayKey } from "@/lib/atendimentos";

/** O que uma seta anda por clique, no modo atual. */
function stepLabels(view: ViewMode): { prev: string; next: string } {
  if (view === "mes") return { prev: "Mês anterior", next: "Próximo mês" };
  if (view === "semana")
    return { prev: "Semana anterior", next: "Próxima semana" };
  return { prev: "Dia anterior", next: "Próximo dia" };
}

/** O período visível por extenso: "Agosto de 2026", "18/05 - 24/05/2025"... */
function periodLabel(view: ViewMode, date: string): string {
  if (view === "mes") return formatMonthHeading(date);
  if (view === "semana") return formatWeekHeading(date);
  return formatDayHeading(date);
}

/**
 * A paginação da agenda: volta e avança um dia, uma semana ou um mês conforme
 * o modo, com o período visível no meio.
 *
 * Aparece duas vezes na tela de propósito. A grade do mês é alta o bastante
 * para empurrar a barra do topo para fora da tela, e quem rolou até a última
 * semana de agosto quer ir para setembro dali mesmo, sem subir de volta.
 *
 * `full` é a barra do topo, com "Hoje" e o seletor de data; `compact` é a do
 * rodapé, só o necessário para dar mais um passo.
 */
export function AgendaNav({
  view,
  date,
  onStep,
  onGoTo,
  variant = "full",
}: {
  view: ViewMode;
  /** Dia de referência do período visível, "YYYY-MM-DD". */
  date: string;
  onStep: (dir: -1 | 1) => void;
  onGoTo: (date: string) => void;
  variant?: "full" | "compact";
}) {
  const labels = stepLabels(view);

  if (variant === "compact") {
    return (
      <nav
        aria-label="Navegação da agenda"
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <Button variant="secondary" size="sm" onClick={() => onStep(-1)}>
          <ChevronLeft className="h-4 w-4" />
          {labels.prev}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onGoTo(dayKey(new Date()))}
        >
          Hoje
        </Button>

        <Button variant="secondary" size="sm" onClick={() => onStep(1)}>
          {labels.next}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Navegação da agenda"
      className="flex flex-wrap items-center gap-2"
    >
      <div className="flex items-center gap-1">
        <NavButton label={labels.prev} onClick={() => onStep(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <NavButton label={labels.next} onClick={() => onStep(1)}>
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>

      <p className="rounded-xl border border-graphite/10 bg-surface px-4 py-2 font-heading text-sm font-semibold text-graphite">
        {periodLabel(view, date)}
      </p>

      <Button
        variant="secondary"
        size="sm"
        onClick={() => onGoTo(dayKey(new Date()))}
      >
        Hoje
      </Button>

      <div className="w-40">
        <DatePicker
          aria-label="Ir para data"
          mode="date"
          value={date}
          onChange={(value) => value && onGoTo(value)}
        />
      </div>
    </nav>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl border border-graphite/10",
        "bg-surface text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite",
      )}
    >
      {children}
    </button>
  );
}
