import * as React from "react";
import { cn } from "./cn";

export function ActionGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}
      {...props}
    />
  );
}

type TileProps = {
  label: string;
  icon?: React.ReactNode;
  color: string;
  soon?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

/** Tile colorido da grade "Adicionar". `soon` marca itens ainda não implementados. */
export function ActionTile({ label, icon, color, soon, className, disabled, ...props }: TileProps) {
  return (
    <button
      type="button"
      disabled={disabled || soon}
      className={cn(
        "group relative flex flex-col items-start justify-between gap-6 rounded-2xl p-4 text-left text-white shadow-card transition-transform",
        "hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        (disabled || soon) && "cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-card",
        className,
      )}
      style={{ backgroundColor: color }}
      {...props}
    >
      <span className="text-2xl opacity-95" aria-hidden>
        {icon}
      </span>
      <span className="text-sm font-semibold leading-tight">{label}</span>
      {soon && (
        <span className="absolute right-2 top-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
          em breve
        </span>
      )}
    </button>
  );
}
