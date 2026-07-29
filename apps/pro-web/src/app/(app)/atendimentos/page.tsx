import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@mylivepet/ui";
import { AtendimentosView } from "@/components/atendimentos-view";
import { fetchAtendimentos, isBucket } from "@/lib/atendimentos";
import { fetchBehaviorCategories } from "@/lib/behavior";
import { getActiveTenant } from "@/lib/tenant";

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

  const [rows, { data: collaborators }, { data: cameras }, behaviorCategories] =
    await Promise.all([
      fetchAtendimentos(
        supabase,
        activeTab === "historico"
          ? { historyFrom: dateFrom, historyTo: dateTo }
          : undefined,
      ),
      supabase
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
    ]);

  return (
    <div>
      <PageHeader
        title="Atendimentos"
        subtitle="Agenda e andamento dos serviços."
      />

      <AtendimentosView
        initial={rows}
        collaborators={collaborators ?? []}
        cameras={cameras ?? []}
        behaviorCategories={behaviorCategories}
        activeTab={activeTab}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}
