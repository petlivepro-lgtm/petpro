"use client";

import { useMemo } from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import {
  Button,
  Checkbox,
  ChoiceChips,
  ColorSwatchInput,
  CurrencyInput,
  Input,
  Label,
} from "@mylivepet/ui";
import {
  formatBRL,
  formatVariantLabel,
  PRODUCT_COLORS,
  WEIGHT_UNITS,
  type WeightUnit,
} from "@mylivepet/types";

export type VariantRow = {
  /** Presente = variação já salva; ausente = nova (ainda sem id no banco). */
  id?: string;
  /** Chave estável de render — o id do banco não existe para linhas novas. */
  key: string;
  color_name: string | null;
  color_hex: string | null;
  size: string;
  weight_value: string;
  weight_unit: WeightUnit;
  price_cents: number | null;
  stock: string;
  active: boolean;
};

export function emptyVariantRow(): VariantRow {
  return {
    key: crypto.randomUUID(),
    color_name: null,
    color_hex: null,
    size: "",
    weight_value: "",
    weight_unit: "g",
    price_cents: null,
    stock: "",
    active: true,
  };
}

/** Serialização enviada ao server action no hidden `variants`. */
export function serializeVariants(rows: VariantRow[]) {
  return rows.map((r) => ({
    id: r.id,
    color_name: r.color_name ?? undefined,
    color_hex: r.color_hex ?? undefined,
    size: r.size.trim() || undefined,
    weight_value: r.weight_value.trim() ? Number(r.weight_value.replace(",", ".")) : undefined,
    weight_unit: r.weight_value.trim() ? r.weight_unit : undefined,
    price_cents: r.price_cents ?? 0,
    stock: Number.parseInt(r.stock, 10) || 0,
    active: r.active,
  }));
}

export function variantTotals(rows: VariantRow[]) {
  const active = rows.filter((r) => r.active);
  const stock = active.reduce((sum, r) => sum + (Number.parseInt(r.stock, 10) || 0), 0);
  const prices = active.map((r) => r.price_cents ?? 0);
  return { stock, minPrice: prices.length > 0 ? Math.min(...prices) : null };
}

/**
 * Editor das variações (SKUs) do produto. Cada linha vira uma linha em
 * `product_variant`, com preço e estoque próprios; o estoque e o preço do
 * produto passam a ser derivados delas (soma / menor preço), calculados por
 * trigger no banco (0020_product_variants.sql).
 */
export function ProductVariantsInput({
  rows,
  onChange,
  currentStock,
}: {
  rows: VariantRow[];
  onChange: (rows: VariantRow[]) => void;
  /** Estoque atual do produto, para avisar sobre a redistribuição. */
  currentStock?: number;
}) {
  const totals = useMemo(() => variantTotals(rows), [rows]);

  // Produto que já tinha estoque e ganhou variações: a agregação vai
  // sobrescrever o valor antigo pela soma das variações.
  const showRedistributeWarning =
    rows.length > 0 && (currentStock ?? 0) > 0 && totals.stock !== currentStock;

  function update(key: string, patch: Partial<VariantRow>) {
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-neutral">
          Sem variações: o produto usa o preço e o estoque preenchidos acima. Adicione
          variações quando o mesmo produto tiver cores, tamanhos ou pesos diferentes —
          cada uma com preço e estoque próprios.
        </p>
      ) : (
        rows.map((row, index) => {
          const label = formatVariantLabel({
            color_name: row.color_name,
            size: row.size,
            weight_value: row.weight_value ? Number(row.weight_value.replace(",", ".")) : null,
            weight_unit: row.weight_value ? row.weight_unit : null,
          });
          return (
            <div
              key={row.key}
              className="space-y-3 rounded-xl border border-graphite/10 bg-surface-muted/40 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-graphite">
                  {label ?? `Variação ${index + 1}`}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
                  aria-label={`Remover ${label ?? `variação ${index + 1}`}`}
                  className="rounded-lg p-1.5 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div>
                <Label>Cor</Label>
                <ColorSwatchInput
                  options={PRODUCT_COLORS}
                  value={row.color_name}
                  aria-label="Cor da variação"
                  onChange={(color) =>
                    update(row.key, {
                      color_name: color?.name ?? null,
                      color_hex: color?.hex ?? null,
                    })
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`size-${row.key}`}>Tamanho</Label>
                  <Input
                    id={`size-${row.key}`}
                    value={row.size}
                    maxLength={30}
                    onChange={(e) => update(row.key, { size: e.target.value })}
                    placeholder="Ex.: P, M, G, nº 3, 40cm"
                  />
                </div>
                <div>
                  <Label htmlFor={`weight-${row.key}`}>Peso</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`weight-${row.key}`}
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.weight_value}
                      onChange={(e) => update(row.key, { weight_value: e.target.value })}
                      placeholder="0"
                    />
                    <ChoiceChips
                      aria-label="Unidade de peso"
                      allowEmpty={false}
                      className="shrink-0 flex-nowrap items-center"
                      options={WEIGHT_UNITS.map((u) => ({ value: u, label: u }))}
                      value={row.weight_unit}
                      onChange={(v) => update(row.key, { weight_unit: (v as WeightUnit) ?? "g" })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`price-${row.key}`}>Preço *</Label>
                  <CurrencyInput
                    id={`price-${row.key}`}
                    cents={row.price_cents}
                    onCentsChange={(cents) => update(row.key, { price_cents: cents })}
                  />
                </div>
                <div>
                  <Label htmlFor={`stock-${row.key}`}>Estoque (un.) *</Label>
                  <Input
                    id={`stock-${row.key}`}
                    type="number"
                    min="0"
                    step="1"
                    value={row.stock}
                    onChange={(e) => update(row.key, { stock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>

              <Checkbox
                checked={row.active}
                onChange={(e) => update(row.key, { active: e.target.checked })}
                label="Disponível"
              />
            </div>
          );
        })
      )}

      {showRedistributeWarning && (
        <p className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-graphite">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            O produto tem {currentStock} un. em estoque e as variações somam {totals.stock} un.
            Ao salvar, o estoque do produto passa a ser a soma das variações — distribua as
            unidades entre elas.
          </span>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...rows, emptyVariantRow()])}
        >
          <Plus className="h-4 w-4" /> Adicionar variação
        </Button>
        {rows.length > 0 && (
          <span className="text-xs text-gray-neutral">
            Estoque total: {totals.stock} un.
            {totals.minPrice !== null && ` · a partir de ${formatBRL(totals.minPrice)}`}
          </span>
        )}
      </div>
    </div>
  );
}
