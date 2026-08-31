import { Sparkles } from "lucide-react";
import { StatusChip } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import {
  AddonDialog,
  DeleteAddonDialog,
  type AddonRow,
} from "@/components/addon-dialog";

/**
 * Lista dos serviços adicionais (0056). Tabela simples de propósito: são só
 * nome e preço, então não há o que mostrar num card nem o que alternar entre
 * visões, ao contrário do catálogo de serviços.
 */
export function ServicosAdicionais({ addons }: { addons: AddonRow[] }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-graphite">
            Serviços adicionais
          </h2>
          <p className="text-sm text-gray-neutral">
            Extras escolhidos junto do serviço no agendamento e somados ao valor
            do atendimento.
          </p>
        </div>
        <AddonDialog />
      </div>

      {addons.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-graphite/15 bg-surface px-5 py-6 text-sm text-gray-neutral">
          <Sparkles className="h-5 w-5 shrink-0 text-gray-neutral" />
          <p>
            Nenhum adicional cadastrado. Cadastre extras como hidratação ou
            perfume para oferecer no agendamento.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <caption className="sr-only">Serviços adicionais</caption>
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-gray-neutral">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Adicional
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Preço
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-3 text-right font-semibold"
                  >
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite/5">
                {addons.map((addon) => (
                  <tr
                    key={addon.id}
                    className="transition-colors hover:bg-surface-muted/60"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <p className="font-heading font-semibold text-graphite">
                          {addon.name}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 font-heading font-semibold text-graphite">
                      {formatBRL(addon.price_cents)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <StatusChip tone={addon.active ? "success" : "danger"}>
                        {addon.active ? "Ativo" : "Inativo"}
                      </StatusChip>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <AddonDialog addon={addon} />
                        <DeleteAddonDialog addon={addon} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
