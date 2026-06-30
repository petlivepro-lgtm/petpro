"use client";

import * as React from "react";
import { cn } from "./cn";

type Props = {
  /** Nota selecionada (0–10) ou null quando ainda não respondida. */
  value: number | null;
  /** Quando ausente, exibe apenas (somente leitura). */
  onChange?: (value: number) => void;
  className?: string;
};

/** Escala de 0 a 10 em botões. Clicável quando `onChange` é passado; senão, só exibe. */
export function ScaleSelector({ value, onChange, className }: Props) {
  const readonly = !onChange;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {Array.from({ length: 11 }, (_, n) => {
        const selected = value === n;
        const base =
          "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-colors";
        const look = selected
          ? "border-orange bg-orange text-white"
          : "border-graphite/15 bg-surface text-graphite";
        return readonly ? (
          <span key={n} className={cn(base, look)}>
            {n}
          </span>
        ) : (
          <button
            key={n}
            type="button"
            aria-label={`Nota ${n}`}
            aria-pressed={selected}
            onClick={() => onChange(n)}
            className={cn(base, look, "hover:border-orange")}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
