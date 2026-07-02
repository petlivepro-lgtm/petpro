import * as React from "react";
import { cn } from "./cn";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Texto/conteúdo exibido ao lado da caixa. */
  label?: React.ReactNode;
};

/**
 * Checkbox estilizado com a marca (caixa laranja com check branco).
 * Funciona controlado (checked/onChange) ou em formulários (name/defaultChecked).
 * O check é branco e fica invisível sobre o fundo branco quando desmarcado,
 * dispensando estado JS para exibi-lo.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, Props>(
  ({ label, className, disabled, ...props }, ref) => (
    <label
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2 text-sm text-graphite",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input ref={ref} type="checkbox" disabled={disabled} className="peer sr-only" {...props} />
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-graphite/25 bg-white text-white transition-colors peer-checked:border-orange peer-checked:bg-orange peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40 peer-focus-visible:ring-offset-2 group-hover:border-orange/50 peer-checked:group-hover:border-orange"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
          <path
            d="m5 10.5 3.5 3.5L15 7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label != null && <span className="min-w-0">{label}</span>}
    </label>
  ),
);
Checkbox.displayName = "Checkbox";
