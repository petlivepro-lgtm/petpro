"use client";

import * as React from "react";
import { createPortal } from "react-dom";
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

function formatValue(d: Date, withTime: boolean, hour: number, minute: number) {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    (withTime ? `T${pad(hour)}:${pad(minute)}` : "")
  );
}

type Props = {
  /** Nome do campo no formulário (gera input hidden). Opcional no modo controlado. */
  name?: string;
  mode?: "date" | "datetime";
  /** Modo controlado: valor "YYYY-MM-DD[THH:mm]" ("" = vazio). */
  value?: string | null;
  /** Modo controlado: chamado com "YYYY-MM-DD[THH:mm]" ou "" ao limpar. */
  onChange?: (value: string) => void;
  defaultValue?: string | null;
  /** Data mínima/máxima selecionável ("YYYY-MM-DD"). */
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Campo de data (e hora) com popover/calendário próprio, estilizado com a marca.
 * Padrão do projeto para TODO campo de data — nunca usar input type="date" nativo.
 * O popover é renderizado em portal (position: fixed), então nunca é cortado por
 * contêineres com overflow (cards, dialogs) e vira para cima quando falta espaço.
 */
export function DatePicker({
  name,
  mode = "datetime",
  value,
  onChange,
  defaultValue,
  min,
  max,
  required,
  placeholder,
  id,
  className,
}: Props) {
  const withTime = mode === "datetime";
  const isControlled = value !== undefined;
  const initial = parseValue(isControlled ? value : defaultValue);

  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState<Date | null>(initial);
  const selected = isControlled ? parseValue(value) : internal;
  const [view, setView] = React.useState(() => initial ?? new Date());
  const [hour, setHour] = React.useState(initial ? initial.getHours() : 9);
  const [minute, setMinute] = React.useState(initial ? initial.getMinutes() : 0);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const updatePos = React.useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - pop.offsetWidth - margin));
    let top = r.bottom + margin;
    // vira para cima quando não cabe abaixo e há espaço acima
    if (top + pop.offsetHeight > window.innerHeight - margin && r.top - pop.offsetHeight - margin > 0) {
      top = r.top - pop.offsetHeight - margin;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - pop.offsetHeight - margin));
    setPos({ top, left });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, updatePos]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (!o) {
        setPos(null);
        setView(selected ?? new Date());
      }
      return !o;
    });
  }

  function commit(next: Date | null, h = hour, m = minute) {
    if (!isControlled) setInternal(next);
    onChange?.(next ? formatValue(next, withTime, h, m) : "");
  }

  // valor enviado ao formulário: YYYY-MM-DD[THH:mm]
  const fieldValue = selected ? formatValue(selected, withTime, hour, minute) : "";

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
  const minDate = parseValue(min);
  const maxDate = parseValue(max);
  const isDisabled = (d: Date) =>
    Boolean((minDate && d < minDate) || (maxDate && d > maxDate));

  function pickDay(d: Date) {
    commit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute));
    if (!withTime) setOpen(false);
  }

  function setNow() {
    const now = new Date();
    setView(now);
    setHour(now.getHours());
    setMinute(now.getMinutes());
    commit(now, now.getHours(), now.getMinutes());
  }

  return (
    <div className="relative" ref={anchorRef}>
      <button
        type="button"
        id={id}
        onClick={toggle}
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

      {name && <input type="hidden" name={name} value={fieldValue} required={required} />}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            style={
              pos
                ? { position: "fixed", top: pos.top, left: pos.left }
                : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
            }
            className="z-[100] w-72 rounded-2xl border border-graphite/10 bg-surface p-3 shadow-card-hover"
          >
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
                const dayDisabled = isDisabled(d);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => pickDay(d)}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-lg text-sm transition-colors",
                      dayDisabled
                        ? "cursor-not-allowed text-gray-neutral/25"
                        : isSelected
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
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHour(h);
                    if (selected) commit(selected, h, minute);
                  }}
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
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setMinute(m);
                    if (selected) commit(selected, hour, m);
                  }}
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
                onClick={() => commit(null)}
                className="text-gray-neutral hover:text-graphite"
              >
                Limpar
              </button>
              <button type="button" onClick={setNow} className="text-orange hover:underline">
                {withTime ? "Agora" : "Hoje"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
