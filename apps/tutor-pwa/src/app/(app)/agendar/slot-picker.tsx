"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
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
 * Grade de horários de 30 min do colaborador no dia escolhido. Ficam
 * desabilitados (inclicáveis) os slots já reservados no banco (via RPC
 * get_busy_slots), os do passado e os que outro tutor está reservando neste
 * momento — estes últimos vêm por Realtime Presence (hold efêmero: some sozinho
 * quando o outro tutor troca de horário, fecha a aba ou perde conexão). A
 * garantia final contra conflito continua no trigger do banco.
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
  const [supabase] = useState(() => createClient());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Set<number>>(new Set()); // slots sendo reservados por OUTROS tutores
  const [loading, setLoading] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceKey] = useState(() => crypto.randomUUID());
  // Slot atual sempre acessível ao callback de subscribe (evita closure velha).
  const valueRef = useRef(value);
  valueRef.current = value;

  const collaboratorId = collaborator?.id;

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

  // Ocupação do dia: RPC devolve apenas os instantes já reservados do colaborador.
  useEffect(() => {
    setBusy(new Set());
    if (!collaboratorId || !date) return;
    const [y, mo, d] = date.split("-").map(Number);
    const from = new Date(y, mo - 1, d);
    const to = new Date(y, mo - 1, d + 1);

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("get_busy_slots", {
        p_tenant_id: tenantId,
        p_collaborator_id: collaboratorId,
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
  }, [supabase, tenantId, collaboratorId, date]);

  // Canal de presença por colaborador: publica o horário que este tutor está
  // segurando e observa os que os demais estão segurando. O payload carrega o
  // ISO completo (com data), então um hold em outro dia não afeta esta grade.
  useEffect(() => {
    setHeld(new Set());
    if (!collaboratorId) return;

    const channel = supabase.channel(`holds:${collaboratorId}`, {
      config: { presence: { key: presenceKey } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<{ slot?: string | null }>>;
      const next = new Set<number>();
      for (const [key, metas] of Object.entries(state)) {
        if (key === presenceKey) continue; // ignora o próprio hold
        for (const m of metas) {
          if (m.slot) next.add(new Date(m.slot).getTime());
        }
      }
      setHeld(next);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") channel.track({ slot: valueRef.current || null });
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, collaboratorId, presenceKey]);

  // Atualiza o hold sempre que o tutor troca (ou limpa) o horário escolhido.
  useEffect(() => {
    channelRef.current?.track({ slot: value || null });
  }, [value]);

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
              title={heldByOther ? "Outro tutor está reservando este horário" : undefined}
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
          Horários tracejados estão sendo reservados por outro tutor agora.
        </p>
      )}
    </div>
  );
}
