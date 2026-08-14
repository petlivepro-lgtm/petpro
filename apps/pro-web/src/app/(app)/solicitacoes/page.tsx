import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@mylivepet/ui";
import { SolicitacoesList } from "@/components/solicitacoes-list";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import {
  buildSolicitacaoGroups,
  SOLICITACAO_APPOINTMENT_SELECT,
  SOLICITACAO_RESERVATION_SELECT,
} from "@/lib/solicitacoes";

export default async function SolicitacoesPage() {
  const supabase = await createClient();

  const tenant = await getActiveTenant(supabase);

  const [{ data: appointments }, { data: reservations }, terminals] =
    await Promise.all([
      supabase
        .from("appointment")
        .select(SOLICITACAO_APPOINTMENT_SELECT)
        .eq("status", "REQUESTED")
        .order("created_at", { ascending: true }),
      supabase
        .from("product_reservation")
        .select(SOLICITACAO_RESERVATION_SELECT)
        .in("status", ["RESERVED", "PICKED"])
        .order("created_at", { ascending: true }),
      tenant
        ? loadPaymentTerminals(supabase, tenant.tenantId, { activeOnly: true })
        : Promise.resolve([]),
    ]);

  const groups = buildSolicitacaoGroups(
    (appointments ?? []) as never,
    (reservations ?? []) as never,
  );

  return (
    <div>
      <PageHeader
        title="Solicitações"
        subtitle="Agendamentos e produtos reservados pelos tutores no MyLivePet, aguardando confirmação ou retirada."
      />

      <SolicitacoesList initialGroups={groups} terminals={terminals} />
    </div>
  );
}
