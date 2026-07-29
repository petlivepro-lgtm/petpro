"use client";

import * as React from "react";
import { cn } from "./cn";

function Star({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"}>
      <path
        d="m12 3 2.7 5.5 6 .9-4.35 4.24 1.03 6L12 17.8 6.62 19.6l1.03-6L3.3 9.4l6-.9L12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Size = "sm" | "md" | "lg";

// Tamanhos por modo: o padrão preserva o que já existia (h-5 leitura, h-7 clique).
const READONLY_SIZE: Record<Size, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};
const INTERACTIVE_SIZE: Record<Size, string> = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

type Props = {
  value: number;
  /** Quando ausente, exibe apenas (somente leitura). */
  onChange?: (value: number) => void;
  size?: Size;
  className?: string;
};

/** 5 estrelas. Clicáveis quando `onChange` é passado; senão, só exibe. */
export function RatingStars({ value, onChange, size = "md", className }: Props) {
  const readonly = !onChange;
  return (
    <div
      className={cn(
        "flex items-center text-orange",
        size === "sm" ? "gap-0.5" : "gap-1",
        className,
      )}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        readonly ? (
          <Star key={n} filled={n <= value} className={READONLY_SIZE[size]} />
        ) : (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="transition-transform hover:scale-110"
          >
            <Star filled={n <= value} className={INTERACTIVE_SIZE[size]} />
          </button>
        ),
      )}
    </div>
  );
}
