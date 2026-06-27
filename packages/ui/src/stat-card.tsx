import * as React from "react";
import { cn } from "./cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "#1D4E5F",
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-graphite/5 bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-neutral">{label}</p>
        {icon && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 font-heading text-3xl font-bold text-graphite">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-neutral">{hint}</p>}
    </div>
  );
}
