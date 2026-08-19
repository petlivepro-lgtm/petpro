"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SlotGrid } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import type { BookingCollaborator } from "@/lib/booking-options";

/**
 * Grade de horários do profissional no dia escolhido (render em SlotGrid, do
 * design system). Busca a ocupação real pela RPC get_busy_slots e escuta o
 * mesmo canal de Presence que o app do tutor usa (`holds:<colaborador>`): assim
 * o balcão enxerga o horário que um tutor está segurando neste instante, e
 * vice-versa. A garantia final contra conflito é o trigger do banco.
 */
export function SlotPicker({
  tenantId,
  collaborator,
  date,
  value,
  onChange,
}: {
  tenantId: string;
  collaborator: BookingCollaborator | undefined;
  date: string; // "YYYY-MM-DD" ou ""
  value: string; // ISO do slot escolhido ou ""
  onChange: (iso: string) => void;
}) {
  const [supabase] = useState(() => createClient());
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceKey] = useState(() => crypto.randomUUID());
  const valueRef = useRef(value);
  valueRef.current = value;

  const collaboratorId = collaborator?.id;

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
        setBusy(
          new Set((data ?? []).map((iso: string) => new Date(iso).getTime())),
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, tenantId, collaboratorId, date]);

  useEffect(() => {
    setHeld(new Set());
    if (!collaboratorId) return;

    const channel = supabase.channel(`holds:${collaboratorId}`, {
      config: { presence: { key: presenceKey } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ slot?: string | null }>
      >;
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
      if (status === "SUBSCRIBED")
        channel.track({ slot: valueRef.current || null });
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [supabase, collaboratorId, presenceKey]);

  // Publica o horário que este atendente está segurando.
  useEffect(() => {
    channelRef.current?.track({ slot: value || null });
  }, [value]);

  return (
    <SlotGrid
      schedule={collaborator?.collaborator_schedule}
      date={date}
      busy={busy}
      held={held}
      loading={loading}
      value={value}
      onChange={onChange}
      emptyHint="Escolha o profissional e a data para ver os horários livres."
      heldHint="Horários tracejados estão sendo reservados agora (por um tutor no app ou outro atendente)."
    />
  );
}
