"use client";

import * as React from "react";
import { cn } from "./cn";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Formata centavos (inteiro) como "R$ 1.000,00". */
function format(cents: number): string {
  return brl.format(cents / 100);
}

type Props = {
  /** Omitido no modo controlado (o valor não viaja por input oculto). */
  name?: string;
  defaultCents?: number | null;
  /** Modo controlado: informe junto com `onCentsChange`. */
  cents?: number | null;
  onCentsChange?: (cents: number | null) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Campo de moeda BRL: formata "R$ 1.000,00" enquanto o usuário digita.
 * Em formulários, envia o valor em CENTAVOS (inteiro) num input oculto com o
 * `name` informado; passando `cents`/`onCentsChange` opera controlado (usado
 * onde o valor entra em um estado maior, como o editor de variações).
 */
export function CurrencyInput({
  name,
  defaultCents,
  cents: controlledCents,
  onCentsChange,
  required,
  disabled,
  placeholder = "R$ 0,00",
  id,
  className,
}: Props) {
  const isControlled = controlledCents !== undefined;
  const [innerCents, setInnerCents] = React.useState<number | null>(
    defaultCents != null ? defaultCents : null,
  );
  const cents = isControlled ? controlledCents : innerCents;

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
    const next = digits === "" ? null : Number.parseInt(digits, 10);
    if (!isControlled) setInnerCents(next);
    onCentsChange?.(next);
  }

  return (
    <>
      <input
        id={id}
        inputMode="numeric"
        required={required}
        disabled={disabled}
        value={cents == null ? "" : format(cents)}
        onChange={onChange}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-graphite/15 bg-surface px-3 text-sm text-graphite",
          "placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
          "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-gray-neutral",
          className,
        )}
      />
      {name && <input type="hidden" name={name} value={cents ?? ""} />}
    </>
  );
}
