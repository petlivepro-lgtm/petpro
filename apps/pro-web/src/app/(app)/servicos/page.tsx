import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@mylivepet/ui";
import type { ServiceStepTemplate } from "@mylivepet/types";
import { ServiceDialog, type ServiceRow } from "@/components/service-dialog";
import { ServicosCatalogo } from "@/components/servicos-catalogo";

export default async function ServicosPage() {
  const supabase = await createClient();
  // A RLS já limita ambas as consultas ao tenant do usuário.
  const [{ data }, { data: stepRows }] = await Promise.all([
    supabase
      .from("service_type")
      .select("id, name, description, price_cents, duration_min, active, step_ids")
      .order("name"),
    supabase
      .from("service_step_template")
      .select("id, label")
      .order("position"),
  ]);

  const list = (data ?? []) as ServiceRow[];
  // Biblioteca de etapas (Configurações → Etapas): é dela que o dialog do
  // serviço monta o passo a passo do atendimento.
  const library = (stepRows ?? []) as ServiceStepTemplate[];

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo de serviços disponível para agendamento no MyLivePet."
        actions={<ServiceDialog library={library} />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-6 w-6" />}
          title="Nenhum serviço cadastrado"
          description="Cadastre o primeiro serviço para os tutores poderem agendar no app."
          action={<ServiceDialog library={library} />}
        />
      ) : (
        <ServicosCatalogo services={list} library={library} />
      )}
    </div>
  );
}
