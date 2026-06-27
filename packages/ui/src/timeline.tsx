import * as React from "react";
import { cn } from "./cn";

export function Timeline({ className, ...props }: React.HTMLAttributes<HTMLOListElement>) {
  return <ol className={cn("relative space-y-1", className)} {...props} />;
}

export function TimelineItem({
  title,
  time,
  description,
  color = "#1D4E5F",
  icon,
  last,
}: {
  title: React.ReactNode;
  time?: React.ReactNode;
  description?: React.ReactNode;
  color?: string;
  icon?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-5">
      {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-graphite/10" />}
      <span
        className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-medium text-graphite">{title}</p>
          {time && <span className="text-xs text-gray-neutral">{time}</span>}
        </div>
        {description && <p className="mt-0.5 text-sm text-gray-neutral">{description}</p>}
      </div>
    </li>
  );
}
