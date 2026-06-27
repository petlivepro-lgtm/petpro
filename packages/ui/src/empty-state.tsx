import * as React from "react";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite/15 bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-2xl text-gray-neutral">
          {icon}
        </span>
      )}
      <p className="font-heading font-semibold text-graphite">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-neutral">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
