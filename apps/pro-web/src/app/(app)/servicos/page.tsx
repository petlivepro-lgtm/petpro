import { Scissors, Clock, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatusChip, EmptyState } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { ServiceDialog } from "@/components/service-dialog";
import { DeleteServiceDialog } from "@/components/delete-service-dialog";

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_type")
    .select("id, name, description, price_cents, duration_min, active, default_steps")
    .order("name");

  const list = data ?? [];

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading font-semibold text-graphite">{s.name}</p>
                <StatusChip tone={s.active ? "success" : "danger"}>
                  {s.active ? "Ativo" : "Inativo"}
                </StatusChip>
              </div>
              {s.description && (
                <p className="mt-1 text-sm text-gray-neutral">{s.description}</p>
              )}
              <div className="mt-3 flex items-center gap-3">
                <p className="font-heading text-xl font-bold text-graphite">
                  {formatBRL(s.price_cents)}
                </p>
                <span className="inline-flex items-center gap-1 text-sm text-gray-neutral">
                  <Clock className="h-3.5 w-3.5" /> {s.duration_min}min
                </span>
                {s.default_steps.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-neutral">
                    <ListChecks className="h-3.5 w-3.5" /> {s.default_steps.length}{" "}
                    {s.default_steps.length === 1 ? "passo" : "passos"}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
                {!s.active && <span className="text-xs text-gray-neutral">Oculto no app</span>}
                <div className="ml-auto flex items-center gap-1">
                  <ServiceDialog service={s} />
                  <DeleteServiceDialog serviceId={s.id} serviceName={s.name} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
