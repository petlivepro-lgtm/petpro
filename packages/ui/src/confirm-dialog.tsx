"use client";

import * as React from "react";
import { Dialog } from "./dialog";
import { Button } from "./button";

/**
 * Confirmação em popup — padrão do app no lugar de window.confirm/alert.
 * Controlado pelo consumidor (open/onOpenChange). Quando confirmType="submit",
 * o botão de confirmar envia o <form action={serverAction}> que o envolve.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "primary",
  confirmType = "button",
  onConfirm,
  pending = false,
  pendingLabel = "Aguarde...",
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "danger";
  confirmType?: "button" | "submit";
  onConfirm?: () => void;
  pending?: boolean;
  pendingLabel?: string;
  error?: string | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        {description && <p className="text-sm text-graphite">{description}</p>}
        {children}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type={confirmType}
            variant={confirmVariant}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
