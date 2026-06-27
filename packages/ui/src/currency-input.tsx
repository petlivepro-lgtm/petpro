"use client";

import * as React from "react";
import { cn } from "./cn";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos (inteiro) como "R$ 1.000,00". */
function format(cents: number): string {
  return brl.format(cents / 100);
}

type Props = {
  name: string;
  defaultCents?: number | null;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Campo de moeda BRL: formata "R$ 1.000,00" enquanto o usuário digita.
 * Envia o valor em CENTAVOS (inteiro) num input oculto com o `name` informado.
 */
export function CurrencyInput({
  name,
  defaultCents,
  required,
  placeholder = "R$ 0,00",
  id,
  className,
}: Props) {
  const [cents, setCents] = React.useState<number | null>(
    defaultCents != null ? defaultCents : null,
  );

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    setCents(digits === "" ? null : Number.parseInt(digits, 10));
  }

  return (
    <>
      <input
        id={id}
        inputMode="numeric"
        required={required}
        value={cents == null ? "" : format(cents)}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-graphite/15 bg-surface px-3 text-sm text-graphite",
          "placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
          className,
        )}
      />
      <input type="hidden" name={name} value={cents ?? ""} />
    </>
  );
}
