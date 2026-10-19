"use client";

import * as React from "react";
import { cn } from "./cn";
import { useScrollLock } from "./use-scroll-lock";

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
  useScrollLock(open);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  // O dialog pode ser renderizado de dentro de uma célula de tabela, de um
  // botão alinhado à direita etc.; o reset de texto evita herdar nowrap,
  // alinhamento e peso de fonte e estourar a largura do popup.
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center whitespace-normal break-words p-0 text-left text-base font-normal normal-case tracking-normal sm:items-center sm:p-4">
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
