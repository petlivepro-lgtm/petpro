"use client";

import * as React from "react";
import { formatPhoneBR } from "@mylivepet/types";
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
 * Campo de telefone brasileiro com máscara (xx) xxxxx-xxxx, limitado a 11 dígitos.
 *
 * Funciona uncontrolled (name + defaultValue, para <form action={...}>) ou
 * controlled (value + onChange). A formatação vem de formatPhoneBR, que
 * descarta o DDI 55 — sem isso um telefone legado '+55 11 99999-0000' seria
 * relido como DDD 55 e regravado errado.
 */
export function PhoneInput({
  name,
  defaultValue,
  value,
  onChange,
  required,
  placeholder = "(11) 91234-5678",
  id,
  className,
  autoFocus,
}: Props) {
  const [internal, setInternal] = React.useState(() =>
    formatPhoneBR(defaultValue ?? ""),
  );
  const controlled = value !== undefined;
  const current = controlled ? formatPhoneBR(value) : internal;

  return (
    <input
      id={id}
      name={name}
      required={required}
      inputMode="tel"
      autoComplete="tel"
      autoFocus={autoFocus}
      value={current}
      onChange={(e) => {
        const next = formatPhoneBR(e.target.value);
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
