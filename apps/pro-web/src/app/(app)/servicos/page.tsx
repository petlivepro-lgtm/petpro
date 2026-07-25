import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@mylivepet/ui";
import { ServiceDialog, type ServiceRow } from "@/components/service-dialog";
import { ServicosCatalogo } from "@/components/servicos-catalogo";

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_type")
    .select(
      "id, name, description, price_cents, duration_min, active, default_steps",
    )
    .order("name");

  const list = (data ?? []) as ServiceRow[];

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo de serviços disponível para agendamento no MyLivePet."
        actions={<ServiceDialog />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-6 w-6" />}
          title="Nenhum serviço cadastrado"
          description="Cadastre o primeiro serviço para os tutores poderem agendar no app."
          action={<ServiceDialog />}
        />
      ) : (
        <ServicosCatalogo services={list} />
      )}
    </div>
  );
}
