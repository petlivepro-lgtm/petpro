import * as React from "react";
import { cn } from "./cn";

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-graphite">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-neutral">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
