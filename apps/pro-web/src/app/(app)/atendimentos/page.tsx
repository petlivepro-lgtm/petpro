import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@mylivepet/ui";
import { AtendimentosView } from "@/components/atendimentos-view";
import { fetchAtendimentos, isBucket } from "@/lib/atendimentos";
import { fetchBehaviorCategories } from "@/lib/behavior";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const { tab, from, to } = await searchParams;
  const activeTab = isBucket(tab) ? tab : "hoje";
  const hasDateFilter = activeTab !== "hoje";
  const dateFrom =
    hasDateFilter && from && ISO_DATE.test(from) ? from : undefined;
  const dateTo = hasDateFilter && to && ISO_DATE.test(to) ? to : undefined;

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  // O colaborador vê só a agenda dele — o filtro por profissional não se
  // aplica, e a RLS já devolveria apenas o próprio cadastro.
  const isCollaborator = tenant?.role === "COLLABORATOR";

  const [
    rows,
    { data: collaborators },
    { data: cameras },
    behaviorCategories,
    terminals,
  ] = await Promise.all([
    fetchAtendimentos(
      supabase,
      activeTab === "historico"
        ? { historyFrom: dateFrom, historyTo: dateTo }
        : undefined,
    ),
    isCollaborator
      ? Promise.resolve({ data: [] })
      : supabase
          .from("collaborator")
          .select("id, full_name")
          .eq("active", true)
          .order("full_name"),
    supabase
      .from("camera")
      .select("id, room_label")
      .eq("active", true)
      .order("room_label"),
    tenant
      ? fetchBehaviorCategories(supabase, tenant.tenantId)
      : Promise.resolve([]),
    tenant
      ? loadPaymentTerminals(supabase, tenant.tenantId, { activeOnly: true })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title={isCollaborator ? "Minha agenda" : "Atendimentos"}
        subtitle={
          isCollaborator
            ? "Os atendimentos atribuídos a você."
            : "Agenda e andamento dos serviços."
        }
      />

      <AtendimentosView
        initial={rows}
        collaborators={collaborators ?? []}
        cameras={cameras ?? []}
        behaviorCategories={behaviorCategories}
        terminals={terminals}
        activeTab={activeTab}
        dateFrom={dateFrom}
        dateTo={dateTo}
        isCollaborator={isCollaborator}
      />
    </div>
  );
}
