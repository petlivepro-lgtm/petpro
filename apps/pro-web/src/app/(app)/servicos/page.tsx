import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@mylivepet/ui";
import type { ServiceStepTemplate } from "@mylivepet/types";
import { ServiceDialog, type ServiceRow } from "@/components/service-dialog";
import { AddonDialog, type AddonRow } from "@/components/addon-dialog";
import { ServicosCatalogo } from "@/components/servicos-catalogo";
import { ServicosAdicionais } from "@/components/servicos-adicionais";

export default async function ServicosPage() {
  const supabase = await createClient();
  // A RLS já limita as três consultas ao tenant do usuário.
  const [{ data }, { data: stepRows }, { data: addonRows }] = await Promise.all([
    supabase
      .from("service_type")
      .select("id, name, description, price_cents, duration_min, active, color_hex, step_ids")
      .order("name"),
    supabase
      .from("service_step_template")
      .select("id, label")
      .order("position"),
    supabase
      .from("service_addon")
      .select("id, name, price_cents, active")
      .order("name"),
  ]);

  const list = (data ?? []) as ServiceRow[];
  // Biblioteca de etapas (Configurações → Etapas): é dela que o dialog do
  // serviço monta o passo a passo do atendimento.
  const library = (stepRows ?? []) as ServiceStepTemplate[];
  const addons = (addonRows ?? []) as AddonRow[];

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo de serviços disponível para agendamento no MyLivePet."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AddonDialog />
            <ServiceDialog library={library} />
          </div>
        }
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

      {/* Adicionais acompanham um serviço, então vêm depois do catálogo. */}
      <ServicosAdicionais addons={addons} />
    </div>
  );
}
