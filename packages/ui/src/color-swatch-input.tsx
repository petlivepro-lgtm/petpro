"use client";

import * as React from "react";
import { cn } from "./cn";

export type ColorOption = {
  /** Nome exibido ao lado do círculo e gravado no banco. */
  name: string;
  hex: string;
};

type Props = {
  options: readonly ColorOption[];
  /** Nome da cor selecionada; `null`/`""` = nenhuma. */
  value?: string | null;
  onChange?: (color: ColorOption | null) => void;
  /** Permite desmarcar clicando na cor já selecionada. */
  allowEmpty?: boolean;
  /** Cores que existem no catálogo mas estão indisponíveis (sem estoque). */
  disabledColors?: readonly string[];
  className?: string;
  "aria-label"?: string;
};

/**
 * Seleção de cor em círculos coloridos com o nome ao lado. Usada no cadastro
 * de variações do CRM e na escolha da variação pelo tutor — o mesmo desenho
 * nos dois apps.
 *
 * "Colorido" (multicolor) é desenhado em degradê cônico em vez do hex chapado.
 */
export function ColorSwatchInput({
  options,
  value,
  onChange,
  allowEmpty = true,
  disabledColors,
  className,
  "aria-label": ariaLabel,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Cor"}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value === option.name;
        const disabled = disabledColors?.includes(option.name) ?? false;
        return (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange?.(selected && allowEmpty ? null : option);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-colors",
              selected
                ? "border-orange bg-orange/10 text-graphite"
                : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
              disabled && "cursor-not-allowed opacity-40 line-through hover:border-graphite/15",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-graphite/20 text-white",
                selected && "ring-2 ring-orange ring-offset-1",
              )}
              style={
                isMulticolor(option.name)
                  ? {
                      backgroundImage:
                        "conic-gradient(#DC2626,#FACC15,#16A34A,#2563EB,#7C3AED,#DC2626)",
                    }
                  : { backgroundColor: option.hex }
              }
            >
              {selected && (
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={cn("h-3 w-3", isLight(option.hex) && "text-graphite")}
                >
                  <path
                    d="m5 10.5 3.5 3.5L15 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

function isMulticolor(name: string): boolean {
  return name.toLowerCase() === "colorido";
}

/** Luminância aproximada: define se o check vai branco ou grafite. */
function isLight(hex: string): boolean {
  const v = hex.replace("#", "");
  if (v.length !== 6) return false;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
