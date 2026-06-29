"use client";

import { useCallback } from "react";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { SolicitacaoCard, type SolicitacaoGroup } from "@/components/solicitacao-card";
import {
  buildSolicitacaoGroups,
  SOLICITACAO_APPOINTMENT_SELECT,
  SOLICITACAO_RESERVATION_SELECT,
} from "@/lib/solicitacoes";

export function SolicitacoesList({ initialGroups }: { initialGroups: SolicitacaoGroup[] }) {
  const fetcher = useCallback(async (): Promise<SolicitacaoGroup[]> => {
    const supabase = createClient();
    const [{ data: appointments }, { data: reservations }] = await Promise.all([
      supabase
        .from("appointment")
        .select(SOLICITACAO_APPOINTMENT_SELECT)
        .eq("status", "REQUESTED")
        .order("created_at", { ascending: true }),
      supabase
        .from("product_reservation")
        .select(SOLICITACAO_RESERVATION_SELECT)
        .eq("status", "RESERVED")
        .order("created_at", { ascending: true }),
    ]);
    return buildSolicitacaoGroups(
      (appointments ?? []) as never,
      (reservations ?? []) as never,
    );
  }, []);

  // Observa as tabelas inteiras (sem filtro de status): o refetch já filtra
  // REQUESTED/RESERVED, e assim confirmações/recusas também atualizam ao vivo
  // (um UPDATE que sai de REQUESTED não casaria um filtro status=eq.REQUESTED).
  const groups = useRealtimeList(
    initialGroups,
    fetcher,
    [{ table: "appointment" }, { table: "product_reservation" }],
    "solicitacoes",
  );

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <SolicitacaoCard key={group.tutorId} group={group} />
      ))}
      {groups.length === 0 && (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Nenhuma solicitação pendente"
          description="Quando um tutor agendar ou reservar produtos pelo MyLivePet, o pedido aparece aqui para você confirmar."
        />
      )}
    </div>
  );
}
