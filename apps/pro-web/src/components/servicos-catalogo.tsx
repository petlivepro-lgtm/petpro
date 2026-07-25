"use client";

import { useMemo, useState } from "react";
import { Clock, ListChecks, Scissors, SearchX } from "lucide-react";
import { Button, Card, EmptyState, StatusChip } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { ServiceDialog, type ServiceRow } from "@/components/service-dialog";
import { DeleteServiceDialog } from "@/components/delete-service-dialog";
import {
  CatalogToolbar,
  matchesCatalogSearch,
  useCatalogView,
} from "@/components/catalog-toolbar";

const VIEW_STORAGE_KEY = "mylivepet:pro:servicos:view";

export function ServicosCatalogo({ services }: { services: ServiceRow[] }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useCatalogView(VIEW_STORAGE_KEY);

  const visibleServices = useMemo(
    () =>
      services.filter((service) =>
        matchesCatalogSearch(
          [
            service.name,
            service.description,
            formatBRL(service.price_cents),
            `${service.duration_min} min`,
            `${service.duration_min}min`,
            `${service.default_steps.length} ${
              service.default_steps.length === 1 ? "passo" : "passos"
            }`,
            service.active ? "ativo visível no app" : "inativo oculto no app",
          ],
          query,
        ),
      ),
    [query, services],
  );

  return (
    <div>
      <CatalogToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        searchLabel="Buscar serviços"
        placeholder="Buscar serviços..."
      />

      {visibleServices.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Nenhum serviço encontrado"
          description={`Não encontramos resultados para “${query.trim()}”.`}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setQuery("")}
            >
              Limpar busca
            </Button>
          }
        />
      ) : view === "cards" ? (
        <ServicesCards services={visibleServices} />
      ) : (
        <ServicesTable services={visibleServices} />
      )}
    </div>
  );
}

function ServicesCards({ services }: { services: ServiceRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((service) => (
        <Card key={service.id} className="flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading font-semibold text-graphite">
              {service.name}
            </p>
            <StatusChip tone={service.active ? "success" : "danger"}>
              {service.active ? "Ativo" : "Inativo"}
            </StatusChip>
          </div>
          {service.description && (
            <p className="mt-1 text-sm text-gray-neutral">
              {service.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <p className="font-heading text-xl font-bold text-graphite">
              {formatBRL(service.price_cents)}
            </p>
            <span className="inline-flex items-center gap-1 text-sm text-gray-neutral">
              <Clock className="h-3.5 w-3.5" /> {service.duration_min}min
            </span>
            {service.default_steps.length > 0 && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-neutral">
                <ListChecks className="h-3.5 w-3.5" />{" "}
                {service.default_steps.length}{" "}
                {service.default_steps.length === 1 ? "passo" : "passos"}
              </span>
            )}
          </div>
          <ServiceActions service={service} />
        </Card>
      ))}
    </div>
  );
}

function ServicesTable({ services }: { services: ServiceRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <caption className="sr-only">Catálogo de serviços</caption>
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-gray-neutral">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Serviço
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Preço
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Duração
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Passos
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/5">
            {services.map((service) => (
              <tr
                key={service.id}
                className="transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                      <Scissors className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-heading font-semibold text-graphite">
                        {service.name}
                      </p>
                      {service.description && (
                        <p className="mt-0.5 max-w-xs text-xs text-gray-neutral">
                          {service.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-heading font-semibold text-graphite">
                  {formatBRL(service.price_cents)}
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-neutral">
                  {service.duration_min}min
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-gray-neutral">
                  {service.default_steps.length}{" "}
                  {service.default_steps.length === 1 ? "passo" : "passos"}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusChip tone={service.active ? "success" : "danger"}>
                    {service.active ? "Ativo" : "Inativo"}
                  </StatusChip>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <ServiceDialog service={service} />
                    <DeleteServiceDialog
                      serviceId={service.id}
                      serviceName={service.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceActions({ service }: { service: ServiceRow }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
      {!service.active && (
        <span className="text-xs text-gray-neutral">Oculto no app</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <ServiceDialog service={service} />
        <DeleteServiceDialog
          serviceId={service.id}
          serviceName={service.name}
        />
      </div>
    </div>
  );
}
