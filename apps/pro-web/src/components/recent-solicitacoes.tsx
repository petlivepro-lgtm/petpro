"use client";

import { useCallback } from "react";
import { CalendarClock } from "lucide-react";
import { Card, EmptyState, Avatar } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { mapRecent, RECENT_SOLICITACAO_SELECT, type RecentRequest } from "@/lib/solicitacoes";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function RecentSolicitacoes({ initial }: { initial: RecentRequest[] }) {
  const fetcher = useCallback(async (): Promise<RecentRequest[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("appointment")
      .select(RECENT_SOLICITACAO_SELECT)
      .eq("status", "REQUESTED")
      .order("created_at", { ascending: true })
      .limit(5);
    return mapRecent((data ?? []) as never);
  }, []);

  // Sem filtro de status: o refetch já restringe a REQUESTED e captamos também
  // as confirmações/recusas (que tiram o item da lista).
  const items = useRealtimeList(
    initial,
    fetcher,
    [{ table: "appointment" }],
    "dashboard-solicitacoes",
  );

  return (
    <div className="space-y-3">
      {items.map((a) => (
        <Card key={a.id} className="flex items-center gap-3 p-4">
          <Avatar name={a.tutorName} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-graphite">
              {a.petName} · {a.serviceName}
            </p>
            <p className="text-xs text-gray-neutral">{formatDate(a.scheduled_at)}</p>
          </div>
        </Card>
      ))}
      {items.length === 0 && (
        <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nenhuma solicitação pendente" />
      )}
    </div>
  );
}
