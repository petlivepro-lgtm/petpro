"use client";

import * as React from "react";
import { formatCpfBR } from "@mylivepet/types";
import { cn } from "./cn";

type Props = {
  name?: string;
  defaultValue?: string | null;
  /** Modo controlado: passe value + onChange (recebe o valor já mascarado). */
  value?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  autoFocus?: boolean;
};

/**
 * Campo de CPF com máscara 000.000.000-00, limitado a 11 dígitos.
 *
 * Funciona uncontrolled (name + defaultValue, para <form action={...}>) ou
 * controlled (value + onChange). Sem maxLength: quem corta é formatCpfBR, para
 * a regra dos 11 dígitos viver num lugar só.
 */
export function CpfInput({
  name,
  defaultValue,
  value,
  onChange,
  required,
  placeholder = "000.000.000-00",
  id,
  className,
  autoFocus,
}: Props) {
  const [internal, setInternal] = React.useState(() =>
    formatCpfBR(defaultValue ?? ""),
  );
  const controlled = value !== undefined;
  const current = controlled ? formatCpfBR(value) : internal;

  return (
    <input
      id={id}
      name={name}
      required={required}
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      value={current}
      onChange={(e) => {
        const next = formatCpfBR(e.target.value);
        if (!controlled) setInternal(next);
        onChange?.(next);
      }}
      placeholder={placeholder}
      className={cn(
        "h-11 w-full rounded-xl border border-graphite/15 bg-surface px-3 text-sm text-graphite",
        "placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
        className,
      )}
    />
  );
}
