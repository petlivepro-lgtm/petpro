"use client";

import { CurrencyInput, Label } from "@mylivepet/ui";
import { PET_SIZES, PET_SIZE_LABEL, type SizePrices } from "@mylivepet/types";

/** Nome do campo no formulário: "price_mini", "price_pequeno", ... */
const FIELD = {
  mini: "price_mini",
  pequeno: "price_pequeno",
  medio: "price_medio",
  grande: "price_grande",
  gigante: "price_gigante",
} as const;

const COLUMN = {
  mini: "price_mini_cents",
  pequeno: "price_pequeno_cents",
  medio: "price_medio_cents",
  grande: "price_grande_cents",
  gigante: "price_gigante_cents",
} as const;

/**
 * Preço por porte do serviço e do adicional (0058).
 *
 * Porte em branco não é "de graça": é "sem preço próprio", e cai no preço base.
 * Por isso o CurrencyInput vazio manda string vazia e o servidor grava null —
 * ver toCentsOrNull em servicos/actions.ts.
 */
export function SizePriceFields({
  idPrefix,
  values,
}: {
  /** Prefixo dos ids, para os dois diálogos poderem conviver na mesma página. */
  idPrefix: string;
  values?: SizePrices | null;
}) {
  return (
    <div className="rounded-xl border border-dashed border-graphite/15 p-4">
      <p className="text-sm font-semibold text-graphite">
        Preço por porte{" "}
        <span className="font-normal text-gray-neutral">(opcional)</span>
      </p>
      <p className="mb-3 mt-0.5 text-xs text-gray-neutral">
        No agendamento o valor sai do porte do pet, sem ninguém precisar
        escolher. Porte deixado em branco usa o preço acima.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {PET_SIZES.map((size) => (
          <div key={size}>
            <Label htmlFor={`${idPrefix}-${FIELD[size]}`}>
              {PET_SIZE_LABEL[size]}
            </Label>
            <CurrencyInput
              id={`${idPrefix}-${FIELD[size]}`}
              name={FIELD[size]}
              defaultCents={values?.[COLUMN[size]] ?? null}
              placeholder="Usa o preço base"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
