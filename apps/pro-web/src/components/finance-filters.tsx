"use client";

import Link from "next/link";
import { Filter, Search, X } from "lucide-react";
import { Button, Card, DatePicker, Input, Label, Select } from "@mylivepet/ui";
import {
  FINANCE_MOVEMENT_KINDS,
  FINANCE_MOVEMENT_KIND_LABEL,
  FINANCE_ORIGINS,
  FINANCE_ORIGIN_LABEL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STOCK_MOVEMENT_SOURCES,
  STOCK_MOVEMENT_SOURCE_LABEL,
  STOCK_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE_LABEL,
} from "@mylivepet/types";

export type ManagementFilterValues = {
  q: string;
  from: string;
  to: string;
  min: string;
  max: string;
  kind: string;
  origin: string;
  payment: string;
  item: string;
};

export function FinanceFilters({
  tab,
  values,
  items,
}: {
  tab: "financeiro" | "estoque";
  values: ManagementFilterValues;
  items: { id: string; label: string; group: "Produtos" | "Serviços" }[];
}) {
  const isStock = tab === "estoque";
  const clearHref = `/financeiro?tab=${tab}`;

  return (
    <Card className="mb-6 p-4">
      <form method="get" className="space-y-4">
        <input type="hidden" name="tab" value={tab} />

        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_repeat(2,minmax(150px,0.35fr))]">
          <div>
            <Label htmlFor="management-q">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral" />
              <Input
                id="management-q"
                name="q"
                defaultValue={values.q}
                className="pl-9"
                placeholder={
                  isStock
                    ? "Produto ou variação"
                    : "Cliente, CPF, telefone, pet, colaborador, produto ou serviço"
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="management-from">De</Label>
            <DatePicker
              id="management-from"
              name="from"
              mode="date"
              defaultValue={values.from}
              max={values.to || undefined}
            />
          </div>
          <div>
            <Label htmlFor="management-to">Até</Label>
            <DatePicker
              id="management-to"
              name="to"
              mode="date"
              defaultValue={values.to}
              min={values.from || undefined}
            />
          </div>
        </div>

        <div
          className={
            isStock
              ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              : "grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
          }
        >
          {!isStock && (
            <>
              <div>
                <Label htmlFor="management-min">Valor mínimo</Label>
                <Input
                  id="management-min"
                  name="min"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={values.min}
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label htmlFor="management-max">Valor máximo</Label>
                <Input
                  id="management-max"
                  name="max"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={values.max}
                  placeholder="R$ 0,00"
                />
              </div>
            </>
          )}

          <div>
            <Label htmlFor="management-kind">Tipo</Label>
            <Select id="management-kind" name="kind" defaultValue={values.kind}>
              <option value="">Todos</option>
              {(isStock ? STOCK_MOVEMENT_TYPES : FINANCE_MOVEMENT_KINDS).map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {isStock
                      ? STOCK_MOVEMENT_TYPE_LABEL[
                          kind as (typeof STOCK_MOVEMENT_TYPES)[number]
                        ]
                      : FINANCE_MOVEMENT_KIND_LABEL[
                          kind as (typeof FINANCE_MOVEMENT_KINDS)[number]
                        ]}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div>
            <Label htmlFor="management-origin">Origem</Label>
            <Select
              id="management-origin"
              name="origin"
              defaultValue={values.origin}
            >
              <option value="">Todas</option>
              {(isStock ? STOCK_MOVEMENT_SOURCES : FINANCE_ORIGINS).map(
                (origin) => (
                  <option key={origin} value={origin}>
                    {isStock
                      ? STOCK_MOVEMENT_SOURCE_LABEL[
                          origin as (typeof STOCK_MOVEMENT_SOURCES)[number]
                        ]
                      : FINANCE_ORIGIN_LABEL[
                          origin as (typeof FINANCE_ORIGINS)[number]
                        ]}
                  </option>
                ),
              )}
            </Select>
          </div>

          {!isStock && (
            <>
              <div>
                <Label htmlFor="management-payment">Pagamento</Label>
                <Select
                  id="management-payment"
                  name="payment"
                  defaultValue={values.payment}
                >
                  <option value="">Todos</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABEL[method]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="management-item">Serviço/produto</Label>
                <Select
                  id="management-item"
                  name="item"
                  defaultValue={values.item}
                >
                  <option value="">Todos</option>
                  {(["Serviços", "Produtos"] as const).map((group) => {
                    const groupItems = items.filter(
                      (item) => item.group === group,
                    );
                    return groupItems.length > 0 ? (
                      <optgroup key={group} label={group}>
                        {groupItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={clearHref}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-graphite/10 bg-surface-muted px-3 text-sm font-medium text-graphite transition-colors hover:bg-gray-soft"
          >
            <X className="h-4 w-4" /> Limpar
          </Link>
          <Button type="submit" size="sm">
            <Filter className="h-4 w-4" /> Aplicar filtros
          </Button>
        </div>
      </form>
    </Card>
  );
}
