"use client";

import * as React from "react";

export type CollaboratorSchedule = {
  weekday: number; // convenção de Date.getDay() (0=domingo)
  start_time: string; // "08:00" ou "08:00:00"
  end_time: string;
};

/** Tamanho do bloco da grade, em minutos. */
export const SLOT_MINUTES = 30;

/** "08:00" ou "08:00:00" → minutos desde meia-noite. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** "YYYY-MM-DD" → partes numéricas (o pacote roda com índices checados). */
function parseDate(date: string): { y: number; mo: number; d: number } {
  const [y = 0, mo = 1, d = 1] = date.split("-").map(Number);
  return { y, mo, d };
}

function fmt(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Grade visual de horários de um profissional num dia. É pura: recebe a agenda
 * semanal, a ocupação (busy) e os holds efêmeros de outras pessoas (held) já
 * resolvidos — quem busca esses dados é o app, que tem o cliente do Supabase.
 * Compartilhada entre o app do tutor e o do petshop para que a regra de slot
 * seja idêntica nos dois lados.
 */
export function SlotGrid({
  schedule,
  date,
  busy,
  held,
  loading = false,
  value,
  onChange,
  emptyHint = "Escolha o profissional e a data para ver os horários disponíveis.",
  heldHint = "Horários tracejados estão sendo reservados por outra pessoa agora.",
}: {
  /** Janelas de trabalho do profissional; vazio/undefined = nada a mostrar. */
  schedule: CollaboratorSchedule[] | undefined;
  /** "YYYY-MM-DD" ou "" */
  date: string;
  /** Instantes (getTime) já ocupados no banco. */
  busy: Set<number>;
  /** Instantes que outra pessoa está segurando agora. */
  held: Set<number>;
  loading?: boolean;
  /** ISO do slot escolhido ou "". */
  value: string;
  onChange: (iso: string) => void;
  emptyHint?: string;
  heldHint?: string;
}) {
  // Slots (em minutos do dia) a partir das janelas de trabalho no dia da semana.
  const slots = React.useMemo(() => {
    if (!schedule || !date) return [];
    const { y, mo, d } = parseDate(date);
    const weekday = new Date(y, mo - 1, d).getDay();
    const minutes = new Set<number>();
    for (const range of schedule) {
      if (range.weekday !== weekday) continue;
      const start = toMinutes(range.start_time);
      const end = toMinutes(range.end_time);
      for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES)
        minutes.add(m);
    }
    return [...minutes].sort((a, b) => a - b);
  }, [schedule, date]);

  if (!schedule || !date) {
    return <p className="mt-2 text-xs text-gray-neutral">{emptyHint}</p>;
  }

  if (slots.length === 0) {
    return (
      <p className="mt-2 text-sm text-gray-neutral">
        Este profissional não atende neste dia. Escolha outra data.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="mt-2 grid grid-cols-4 gap-2">
        {slots.slice(0, 8).map((m) => (
          <div
            key={m}
            className="h-10 animate-pulse rounded-xl bg-surface-muted"
          />
        ))}
      </div>
    );
  }

  const { y, mo, d } = parseDate(date);
  const now = Date.now();

  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {slots.map((m) => {
          const slotDate = new Date(y, mo - 1, d, Math.floor(m / 60), m % 60);
          const iso = slotDate.toISOString();
          const t = slotDate.getTime();
          const selected = value === iso;
          const taken = busy.has(t);
          const past = t <= now;
          const heldByOther = held.has(t);
          const disabled = taken || past || heldByOther;
          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              title={
                heldByOther
                  ? "Outra pessoa está reservando este horário"
                  : undefined
              }
              onClick={() => onChange(selected ? "" : iso)}
              className={
                "h-10 rounded-xl border text-sm font-medium transition-colors " +
                (selected
                  ? "border-orange bg-orange text-white"
                  : heldByOther
                    ? "cursor-not-allowed border-dashed border-orange/40 bg-orange/5 text-orange/60"
                    : disabled
                      ? "cursor-not-allowed border-graphite/10 text-gray-neutral/50 " +
                        (taken ? "bg-surface-muted line-through" : "bg-surface")
                      : "border-graphite/15 bg-surface text-graphite hover:border-orange/50 hover:bg-orange/5")
              }
            >
              {fmt(m)}
            </button>
          );
        })}
      </div>
      {held.size > 0 && (
        <p className="text-xs text-gray-neutral">
          <span className="mr-1 inline-block h-2 w-2 rounded-full border border-dashed border-orange/60 align-middle" />
          {heldHint}
        </p>
      )}
    </div>
  );
}
