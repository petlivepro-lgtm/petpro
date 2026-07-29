"use client";

import * as React from "react";
import { cn } from "./cn";

export type ChoiceOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type Props = {
  options: readonly ChoiceOption[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  /** Permite desmarcar clicando na opção já selecionada. */
  allowEmpty?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Botões em pílula para uma escolha entre poucas opções (tamanho, peso,
 * categoria). É o que o petshop digita como texto livre virando botão no app
 * do tutor.
 */
export function ChoiceChips({
  options,
  value,
  onChange,
  allowEmpty = true,
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => {
              if (option.disabled) return;
              onChange?.(selected && allowEmpty ? null : option.value);
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              selected
                ? "border-orange bg-orange text-white"
                : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
              option.disabled &&
                "cursor-not-allowed opacity-40 line-through hover:border-graphite/15",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
