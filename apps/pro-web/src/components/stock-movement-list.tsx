"use client";

import { useState } from "react";
import { ArrowDownUp, Link2, PackageSearch } from "lucide-react";
import { Card, Dialog, EmptyState, StatusChip } from "@mylivepet/ui";
import {
  formatVariantLabel,
  STOCK_MOVEMENT_SOURCE_LABEL,
  STOCK_MOVEMENT_TYPE_LABEL,
  type StockMovementDTO,
} from "@mylivepet/types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function StockMovementList({
  movements,
}: {
  movements: StockMovementDTO[];
}) {
  const [selected, setSelected] = useState<StockMovementDTO | null>(null);

  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-6 w-6" />}
        title="Nenhuma movimentação encontrada"
        description="Ajuste os filtros ou registre uma entrada/saída manual."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {movements.map((movement) => (
          <Card key={movement.id} className="p-0">
            <button
              type="button"
              onClick={() => setSelected(movement)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
              aria-label={`Abrir movimentação de ${movement.product?.name ?? "produto"}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-graphite">
                  {movement.product?.name ?? "Produto"}
                  {movement.variant_label && (
                    <span className="font-normal text-gray-neutral">
                      {" "}
                      · {formatVariantLabel(movement.variant_label)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-gray-neutral">
                  {formatDateTime(movement.created_at)} ·{" "}
                  {STOCK_MOVEMENT_SOURCE_LABEL[movement.source]}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <StatusChip
                  tone={movement.type === "IN" ? "success" : "danger"}
                >
                  {STOCK_MOVEMENT_TYPE_LABEL[movement.type]} ·{" "}
                  {movement.quantity} un.
                </StatusChip>
                <p className="mt-1 text-xs text-gray-neutral">
                  {movement.stock_before} → {movement.stock_after} un.
                </p>
              </div>
            </button>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.product?.name ?? "Movimentação de estoque"}
        description="Origem e saldo antes/depois desta movimentação."
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-surface-muted p-4">
              <ArrowDownUp className="h-5 w-5 text-orange" />
              <div>
                <p className="text-sm font-semibold text-graphite">
                  {STOCK_MOVEMENT_TYPE_LABEL[selected.type]} de{" "}
                  {selected.quantity} unidade(s)
                </p>
                <p className="text-xs text-gray-neutral">
                  {formatDateTime(selected.created_at)}
                </p>
              </div>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-neutral">
                  Variação
                </dt>
                <dd className="mt-1 text-sm text-graphite">
                  {selected.variant_label
                    ? formatVariantLabel(selected.variant_label)
                    : "Produto sem variação"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-neutral">
                  Origem
                </dt>
                <dd className="mt-1 text-sm text-graphite">
                  {STOCK_MOVEMENT_SOURCE_LABEL[selected.source]}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-neutral">
                  Estoque anterior
                </dt>
                <dd className="mt-1 text-sm font-semibold text-graphite">
                  {selected.stock_before} un.
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-neutral">
                  Estoque posterior
                </dt>
                <dd className="mt-1 text-sm font-semibold text-graphite">
                  {selected.stock_after} un.
                </dd>
              </div>
            </dl>

            {selected.note && (
              <div className="rounded-xl border border-graphite/10 p-3">
                <p className="text-xs uppercase tracking-wide text-gray-neutral">
                  Observação
                </p>
                <p className="mt-1 text-sm text-graphite">{selected.note}</p>
              </div>
            )}

            {(selected.reservation_id || selected.refund_id) && (
              <div className="flex items-start gap-2 rounded-xl border border-orange/20 bg-orange/5 p-3 text-sm text-graphite">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
                <div>
                  <p className="font-medium">
                    {selected.related?.kind === "REFUND"
                      ? "Devolução vinculada"
                      : selected.related?.kind === "CANCELLATION"
                        ? "Cancelamento vinculado"
                        : selected.related?.kind === "EXPIRATION"
                          ? "Expiração automática"
                          : "Venda ou reserva vinculada"}
                  </p>
                  {selected.related?.customer?.name && (
                    <p className="mt-0.5 text-gray-neutral">
                      Cliente: {selected.related.customer.name}
                    </p>
                  )}
                  {selected.related?.reason && (
                    <p className="mt-0.5 text-gray-neutral">
                      Motivo: {selected.related.reason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
