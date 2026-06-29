"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TableWatch = { table: string; filter?: string };

/**
 * Mantém uma lista sincronizada em tempo real: parte de `initial` (renderizado
 * no server) e, a cada mudança nas tabelas observadas, re-consulta via `fetcher`
 * (filtrado por RLS) e troca o estado. Re-fetch é mais simples e correto do que
 * remendar o payload, e o volume de eventos de um petshop é baixo.
 */
export function useRealtimeList<T>(
  initial: T[],
  fetcher: () => Promise<T[]>,
  watches: TableWatch[],
  channelName: string,
): T[] {
  const [data, setData] = useState<T[]>(initial);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const watchesKey = JSON.stringify(watches);
  const watchesRef = useRef(watches);
  watchesRef.current = watches;

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const next = await fetcherRef.current();
        if (!cancelled) setData(next);
      }, 150);
    };

    const channel = supabase.channel(channelName);

    (async () => {
      // Realtime usa o JWT da sessão para autorizar os eventos via RLS.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }
      if (cancelled) return;
      for (const w of watchesRef.current) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
          refetch,
        );
      }
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, watchesKey]);

  return data;
}
