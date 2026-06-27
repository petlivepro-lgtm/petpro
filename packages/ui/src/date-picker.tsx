"use client";

import * as React from "react";
import { cn } from "./cn";

const timeSelectClass =
  "h-9 rounded-lg border border-graphite/15 bg-surface px-2 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-06-26T19:58" | "2026-06-26" -> Date (hora local). */
function parseValue(v?: string | null): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

type Props = {
  name: string;
  mode?: "date" | "datetime";
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/** Campo de data (e hora) com popover/calendário próprio, estilizado com a marca. */
export function DatePicker({
  name,
  mode = "datetime",
  defaultValue,
  required,
  placeholder,
  id,
  className,
}: Props) {
  const withTime = mode === "datetime";
  const initial = parseValue(defaultValue);

  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Date | null>(initial);
  const [view, setView] = React.useState(() => initial ?? new Date());
  const [hour, setHour] = React.useState(initial ? initial.getHours() : 9);
  const [minute, setMinute] = React.useState(initial ? initial.getMinutes() : 0);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // valor enviado ao formulário: YYYY-MM-DD[THH:mm]
  const fieldValue = selected
    ? `${selected.getFullYear()}-${pad(selected.getMonth() + 1)}-${pad(selected.getDate())}` +
      (withTime ? `T${pad(hour)}:${pad(minute)}` : "")
    : "";

  // texto exibido no botão
  const display = selected
    ? `${pad(selected.getDate())}/${pad(selected.getMonth() + 1)}/${selected.getFullYear()}` +
      (withTime ? ` ${pad(hour)}:${pad(minute)}` : "")
    : "";

  // grade do mês visível (6 semanas)
  const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(1 - firstOfMonth.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const today = new Date();

  function pickDay(d: Date) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
    setSelected(next);
    if (!withTime) setOpen(false);
  }

  function setNow() {
    const now = new Date();
    setSelected(now);
    setView(now);
    setHour(now.getHours());
    setMinute(now.getMinutes());
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-graphite/15 bg-surface px-3 text-sm",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
          display ? "text-graphite" : "text-gray-neutral/70",
          className,
        )}
      >
        <span>{display || placeholder || (withTime ? "dd/mm/aaaa --:--" : "dd/mm/aaaa")}</span>
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-gray-neutral">
          <path
            d="M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <input type="hidden" name={name} value={fieldValue} required={required} />

      {open && (
        <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-graphite/10 bg-surface p-3 shadow-card-hover">
          {/* cabeçalho do mês */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted hover:text-graphite"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <span className="text-sm font-semibold capitalize text-graphite">
              {MONTHS[view.getMonth()]} de {view.getFullYear()}
            </span>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted hover:text-graphite"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* dias da semana */}
          <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-neutral">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-1">
                {w}
              </span>
            ))}
          </div>

          {/* grade de dias */}
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((d, i) => {
              const inMonth = d.getMonth() === view.getMonth();
              const isSelected = selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pickDay(d)}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-sm transition-colors",
                    isSelected
                      ? "bg-orange font-semibold text-white"
                      : isToday
                        ? "font-semibold text-orange hover:bg-orange/10"
                        : inMonth
                          ? "text-graphite hover:bg-surface-muted"
                          : "text-gray-neutral/40 hover:bg-surface-muted",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* hora (somente datetime) */}
          {withTime && (
            <div className="mt-3 flex items-center gap-2 border-t border-graphite/5 pt-3">
              <span className="text-sm text-gray-neutral">Hora</span>
              <select
                aria-label="Hora"
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
                className={timeSelectClass}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {pad(h)}
                  </option>
                ))}
              </select>
              <span className="text-gray-neutral">:</span>
              <select
                aria-label="Minuto"
                value={minute}
                onChange={(e) => setMinute(Number(e.target.value))}
                className={timeSelectClass}
              >
                {Array.from({ length: 60 }, (_, m) => (
                  <option key={m} value={m}>
                    {pad(m)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ações */}
          <div className="mt-3 flex items-center justify-between text-sm font-medium">
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-gray-neutral hover:text-graphite"
            >
              Limpar
            </button>
            <button type="button" onClick={setNow} className="text-orange hover:underline">
              {withTime ? "Agora" : "Hoje"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
