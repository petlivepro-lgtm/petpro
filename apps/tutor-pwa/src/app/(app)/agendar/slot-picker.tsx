"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type CollaboratorSchedule = { weekday: number; start_time: string; end_time: string };
export type Collaborator = {
  id: string;
  full_name: string;
  role_title: string | null;
  collaborator_schedule: CollaboratorSchedule[];
};

const SLOT_MINUTES = 30;

/** "08:00" ou "08:00:00" → minutos desde meia-noite. */
function toMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function fmt(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Grade de horários de 30 min do colaborador no dia escolhido. Slots já
 * reservados (qualquer tutor, via RPC get_busy_slots) ou no passado ficam
 * desabilitados — inclicáveis. O valor selecionado é o ISO do instante.
 */
export function SlotPicker({
  tenantId,
  collaborator,
  date,
  value,
  onChange,
}: {
  tenantId: string;
  collaborator: Collaborator | undefined;
  date: string; // "YYYY-MM-DD" ou ""
  value: string; // ISO do slot escolhido ou ""
  onChange: (iso: string) => void;
}) {
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Slots (em minutos do dia) a partir das janelas de trabalho no dia da semana.
  const slots = useMemo(() => {
    if (!collaborator || !date) return [];
    const [y, mo, d] = date.split("-").map(Number);
    const weekday = new Date(y, mo - 1, d).getDay();
    const minutes = new Set<number>();
    for (const range of collaborator.collaborator_schedule) {
      if (range.weekday !== weekday) continue;
      const start = toMinutes(range.start_time);
      const end = toMinutes(range.end_time);
      for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES) minutes.add(m);
    }
    return [...minutes].sort((a, b) => a - b);
  }, [collaborator, date]);

  // Ocupação do dia: RPC devolve apenas os instantes reservados do colaborador.
  useEffect(() => {
    setBusy(new Set());
    if (!collaborator || !date) return;
    const [y, mo, d] = date.split("-").map(Number);
    const from = new Date(y, mo - 1, d);
    const to = new Date(y, mo - 1, d + 1);

    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .rpc("get_busy_slots", {
        p_tenant_id: tenantId,
        p_collaborator_id: collaborator.id,
        p_from: from.toISOString(),
        p_to: to.toISOString(),
      })
      .then(({ data }) => {
        if (cancelled) return;
        setBusy(new Set((data ?? []).map((iso: string) => new Date(iso).getTime())));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, collaborator, date]);

  if (!collaborator || !date) {
    return (
      <p className="mt-2 text-xs text-gray-neutral">
        Escolha o profissional e a data para ver os horários disponíveis.
      </p>
    );
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
          <div key={m} className="h-10 animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
    );
  }

  const [y, mo, d] = date.split("-").map(Number);
  const now = Date.now();

  return (
    <div className="mt-2 grid grid-cols-4 gap-2">
      {slots.map((m) => {
        const slotDate = new Date(y, mo - 1, d, Math.floor(m / 60), m % 60);
        const iso = slotDate.toISOString();
        const taken = busy.has(slotDate.getTime());
        const past = slotDate.getTime() <= now;
        const disabled = taken || past;
        const selected = value === iso;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(selected ? "" : iso)}
            className={
              "h-10 rounded-xl border text-sm font-medium transition-colors " +
              (selected
                ? "border-orange bg-orange text-white"
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
  );
}
