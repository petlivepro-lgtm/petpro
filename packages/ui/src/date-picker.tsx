"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

const timeSelectClass =
  "h-9 rounded-lg border border-graphite/15 bg-surface px-2 text-sm text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

const calendarSelectClass =
  "h-8 cursor-pointer rounded-lg bg-transparent px-1 text-center text-sm font-semibold capitalize text-graphite hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange";

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

function localToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dayStamp(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** "2026-06-26T19:58" | "2026-06-26" -> Date (hora local). */
function parseValue(v?: string | null): Date | null {
  if (!v) return null;
  const match = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText ?? 0);
  const minute = Number(minuteText ?? 0);
  const parsed = new Date(year, month - 1, day, hour, minute);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) {
    return null;
  }

  return parsed;
}

function parseBoundary(value?: string): Date | null {
  return value === "today" ? localToday() : parseValue(value);
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

function formatDateDisplay(d: Date | null) {
  return d
    ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
    : "";
}

function maskDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDateDisplay(value: string): Date | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return parseValue(`${year}-${month}-${day}`);
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
  /** Data mínima/máxima selecionável ("YYYY-MM-DD"). `max` também aceita "today". */
  min?: string;
  max?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
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
  "aria-label": ariaLabel,
}: Props) {
  const withTime = mode === "datetime";
  const isControlled = value !== undefined;
  const initial = parseValue(isControlled ? value : defaultValue);

  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState<Date | null>(initial);
  const selected = isControlled ? parseValue(value) : internal;
  const [view, setView] = React.useState(() => initial ?? new Date());
  const [hour, setHour] = React.useState(initial ? initial.getHours() : 9);
  const [minute, setMinute] = React.useState(
    initial ? initial.getMinutes() : 0,
  );
  const [inputText, setInputText] = React.useState(() =>
    formatDateDisplay(initial),
  );
  const [inputError, setInputError] = React.useState<string | null>(null);
  const [showInputError, setShowInputError] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  const generatedId = React.useId();
  const errorId = `${id ?? name ?? generatedId}-error`;

  const minDate = parseBoundary(min);
  const maxDate = parseBoundary(max);
  const isDisabled = React.useCallback(
    (date: Date) =>
      Boolean(
        (minDate && dayStamp(date) < dayStamp(minDate)) ||
        (maxDate && dayStamp(date) > dayStamp(maxDate)),
      ),
    [minDate, maxDate],
  );

  React.useEffect(() => {
    if (!isControlled || withTime) return;
    setInputText(formatDateDisplay(parseValue(value)));
    setInputError(null);
    setShowInputError(false);
  }, [isControlled, value, withTime]);

  React.useEffect(() => {
    inputRef.current?.setCustomValidity(inputError ?? "");
  }, [inputError]);

  const updatePos = React.useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(r.left, window.innerWidth - pop.offsetWidth - margin),
    );
    let top = r.bottom + margin;
    // vira para cima quando não cabe abaixo e há espaço acima
    if (
      top + pop.offsetHeight > window.innerHeight - margin &&
      r.top - pop.offsetHeight - margin > 0
    ) {
      top = r.top - pop.offsetHeight - margin;
    }
    top = Math.max(
      margin,
      Math.min(top, window.innerHeight - pop.offsetHeight - margin),
    );
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
    if (!withTime) setInputText(formatDateDisplay(next));
    setInputError(null);
    setShowInputError(false);
    onChange?.(next ? formatValue(next, withTime, h, m) : "");
  }

  function validateTypedDate(text: string) {
    if (!text) {
      commit(null);
      return;
    }

    if (text.length < 10) {
      setInputError("Informe a data completa");
      setShowInputError(false);
      return;
    }

    const parsed = parseDateDisplay(text);
    if (!parsed) {
      setInputError("Informe uma data válida");
      setShowInputError(true);
      return;
    }

    if (minDate && parsed < minDate) {
      setInputError(`A data mínima é ${formatDateDisplay(minDate)}`);
      setShowInputError(true);
      return;
    }

    if (maxDate && parsed > maxDate) {
      setInputError(
        max === "today"
          ? "A data não pode estar no futuro"
          : `A data máxima é ${formatDateDisplay(maxDate)}`,
      );
      setShowInputError(true);
      return;
    }

    setView(parsed);
    commit(parsed);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskDateInput(event.target.value);
    setInputText(masked);
    validateTypedDate(masked);
  }

  // valor enviado ao formulário: YYYY-MM-DD[THH:mm]
  const fieldValue = selected
    ? formatValue(selected, withTime, hour, minute)
    : "";

  // texto exibido no botão
  const display = selected
    ? formatDateDisplay(selected) +
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
  const today = localToday();

  const currentYear = today.getFullYear();
  const firstYear = Math.min(
    minDate?.getFullYear() ?? currentYear - 100,
    selected?.getFullYear() ?? currentYear,
    view.getFullYear(),
  );
  const lastYear = Math.max(
    maxDate?.getFullYear() ?? currentYear + 20,
    selected?.getFullYear() ?? currentYear,
    view.getFullYear(),
  );
  const years = Array.from(
    { length: lastYear - firstYear + 1 },
    (_, index) => firstYear + index,
  );

  function pickDay(d: Date) {
    commit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute));
    if (!withTime) setOpen(false);
  }

  function setNow() {
    const now = new Date();
    if (isDisabled(now)) return;
    setView(now);
    setHour(now.getHours());
    setMinute(now.getMinutes());
    commit(now, now.getHours(), now.getMinutes());
  }

  return (
    <div>
      <div className="relative" ref={anchorRef}>
        {withTime ? (
          <button
            type="button"
            id={id}
            aria-label={ariaLabel}
            onClick={toggle}
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-xl border border-graphite/15 bg-surface px-3 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
              display ? "text-graphite" : "text-gray-neutral/70",
              className,
            )}
          >
            <span>{display || placeholder || "dd/mm/aaaa --:--"}</span>
            <CalendarIcon />
          </button>
        ) : (
          <div
            className={cn(
              "relative flex h-11 w-full items-center rounded-xl border bg-surface",
              "focus-within:ring-2 focus-within:ring-orange",
              showInputError && inputError
                ? "border-danger"
                : "border-graphite/15",
              className,
            )}
          >
            <input
              ref={inputRef}
              type="text"
              id={id}
              value={inputText}
              required={required}
              inputMode="numeric"
              autoComplete="off"
              maxLength={10}
              placeholder={placeholder || "dd/mm/aaaa"}
              aria-label={ariaLabel}
              aria-invalid={showInputError && Boolean(inputError)}
              aria-describedby={
                showInputError && inputError ? errorId : undefined
              }
              onChange={handleInputChange}
              onBlur={() => inputError && setShowInputError(true)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (!open) toggle();
                }
              }}
              className="h-full min-w-0 flex-1 rounded-xl bg-transparent px-3 pr-1 text-sm text-graphite placeholder:text-gray-neutral/70 focus:outline-none"
            />
            <button
              type="button"
              onClick={toggle}
              aria-label={open ? "Fechar calendário" : "Abrir calendário"}
              aria-expanded={open}
              className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            >
              <CalendarIcon />
            </button>
          </div>
        )}

        {name && <input type="hidden" name={name} value={fieldValue} />}

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label="Escolher data"
              style={
                pos
                  ? { position: "fixed", top: pos.top, left: pos.left }
                  : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
              }
              className="z-[100] w-72 rounded-2xl border border-graphite/10 bg-surface p-3 shadow-card-hover"
            >
              {/* cabeçalho do mês */}
              <div className="mb-2 flex items-center justify-between gap-1">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() =>
                    setView(
                      new Date(view.getFullYear(), view.getMonth() - 1, 1),
                    )
                  }
                  className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted hover:text-graphite"
                >
                  <Chevron direction="left" />
                </button>
                <div className="flex min-w-0 items-center justify-center gap-1">
                  <select
                    aria-label="Mês"
                    value={view.getMonth()}
                    onChange={(event) =>
                      setView(
                        new Date(
                          view.getFullYear(),
                          Number(event.target.value),
                          1,
                        ),
                      )
                    }
                    className={cn(calendarSelectClass, "max-w-28")}
                  >
                    {MONTHS.map((month, index) => (
                      <option key={month} value={index}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-neutral">de</span>
                  <select
                    aria-label="Ano"
                    value={view.getFullYear()}
                    onChange={(event) =>
                      setView(
                        new Date(
                          Number(event.target.value),
                          view.getMonth(),
                          1,
                        ),
                      )
                    }
                    className={cn(calendarSelectClass, "w-[4.75rem]")}
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() =>
                    setView(
                      new Date(view.getFullYear(), view.getMonth() + 1, 1),
                    )
                  }
                  className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted hover:text-graphite"
                >
                  <Chevron direction="right" />
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
                <button
                  type="button"
                  disabled={isDisabled(today)}
                  onClick={setNow}
                  className="text-orange hover:underline disabled:cursor-not-allowed disabled:text-gray-neutral/30 disabled:no-underline"
                >
                  {withTime ? "Agora" : "Hoje"}
                </button>
              </div>
            </div>,
            document.body,
          )}
      </div>

      {showInputError && inputError && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {inputError}
        </p>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d={direction === "left" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
