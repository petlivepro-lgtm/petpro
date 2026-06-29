import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@mylivepet/ui";
import { SolicitacoesList } from "@/components/solicitacoes-list";
import {
  buildSolicitacaoGroups,
  SOLICITACAO_APPOINTMENT_SELECT,
  SOLICITACAO_RESERVATION_SELECT,
} from "@/lib/solicitacoes";

export default async function SolicitacoesPage() {
  const supabase = await createClient();

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

  const groups = buildSolicitacaoGroups(
    (appointments ?? []) as never,
    (reservations ?? []) as never,
  );

  return (
    <div>
      <PageHeader
        title="Solicitações"
        subtitle="Agendamentos e produtos reservados pelos tutores no MyLivePet, aguardando confirmação."
      />

      <SolicitacoesList initialGroups={groups} />
    </div>
  );
}
