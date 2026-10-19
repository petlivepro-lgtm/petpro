"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TableWatch } from "@/lib/use-realtime-list";

/**
 * Recarrega a página (Server Components) quando as tabelas observadas mudam.
 * O payload do Realtime não é usado: é só o sinal. Quem decide o que aparece
 * é a consulta do servidor, com a RLS do usuário — e o próprio Realtime só
 * entrega linhas que essa RLS deixa ver.
 */
export function RealtimeRefresh({ channel, watches }: { channel: string; watches: TableWatch[] }) {
  const router = useRouter();
  const key = JSON.stringify(watches);

  useEffect(() => {
    const supabase = createClient();
    const list = JSON.parse(key) as TableWatch[];
    const sub = supabase.channel(channel);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      for (const w of list) {
        sub.on(
          "postgres_changes",
          { event: "*", schema: "public", table: w.table, ...(w.filter ? { filter: w.filter } : {}) },
          refresh,
        );
      }
      sub.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(sub);
    };
  }, [channel, key, router]);

  return null;
}
