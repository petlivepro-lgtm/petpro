"use client";

import * as React from "react";
import { cn } from "./cn";

/** Formata dígitos no padrão BR: (11) 91234-5678 ou (11) 1234-5678. */
function format(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Props = {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/** Campo de telefone brasileiro com máscara (xx) xxxxx-xxxx, limitado a 11 dígitos. */
export function PhoneInput({
  name,
  defaultValue,
  required,
  placeholder = "(11) 91234-5678",
  id,
  className,
}: Props) {
  const [value, setValue] = React.useState(() => format(defaultValue ?? ""));

  return (
    <input
      id={id}
      name={name}
      required={required}
      inputMode="tel"
      value={value}
      onChange={(e) => setValue(format(e.target.value))}
      placeholder={placeholder}
      className={cn(
        "h-11 w-full rounded-xl border border-graphite/15 bg-surface px-3 text-sm text-graphite",
        "placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
        className,
      )}
    />
  );
}
