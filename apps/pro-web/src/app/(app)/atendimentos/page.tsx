import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@mylivepet/ui";
import { AtendimentosView } from "@/components/atendimentos-view";
import { fetchAtendimentos, isBucket } from "@/lib/atendimentos";

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = isBucket(tab) ? tab : "hoje";

  const supabase = await createClient();

  const [rows, { data: collaborators }, { data: cameras }] = await Promise.all([
    fetchAtendimentos(supabase),
    supabase.from("collaborator").select("id, full_name").eq("active", true).order("full_name"),
    supabase.from("camera").select("id, room_label").eq("active", true).order("room_label"),
  ]);

  return (
    <div>
      <PageHeader title="Atendimentos" subtitle="Agenda e andamento dos serviços." />

      <AtendimentosView
        initial={rows}
        collaborators={collaborators ?? []}
        cameras={cameras ?? []}
        activeTab={activeTab}
      />
    </div>
  );
}
