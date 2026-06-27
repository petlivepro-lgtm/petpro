"use client";

import * as React from "react";
import { cn } from "./cn";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-graphite/50" onClick={() => onOpenChange(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-card-hover sm:max-w-lg sm:rounded-2xl",
          className,
        )}
      >
        {(title || description) && (
          <div className="mb-4">
            {title && <h2 className="font-heading text-lg font-bold text-graphite">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-gray-neutral">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
