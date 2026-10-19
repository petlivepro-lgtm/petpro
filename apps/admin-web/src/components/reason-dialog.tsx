"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, Dialog, Label, Textarea } from "@mylivepet/ui";

type Result = { ok: true; data?: string } | { ok: false; error: string };

/**
 * Ação que exige motivo (vai para a auditoria). O motivo é obrigatório no
 * servidor também — a validação daqui é só conforto.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  onDone,
  triggerClassName,
  triggerLabel,
}: {
  trigger: React.ReactNode;
  /** Rótulo acessível quando o gatilho é só um ícone. */
  triggerLabel?: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: (reason: string) => Promise<Result>;
  onDone?: (data?: string) => void;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close(next: boolean) {
    setOpen(next);
    if (!next) {
      setReason("");
      setError(null);
      setDone(null);
    }
  }

  function confirm() {
    setError(null);
    start(async () => {
      const res = await action(reason);
      if (res.ok) {
        if (onDone) {
          onDone(res.data);
          close(false);
        } else {
          setDone(res.data ?? "Feito.");
        }
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label={triggerLabel}>
        {trigger}
      </button>
      {/* Abre no <body>, fora da tabela de onde o gatilho costuma sair. */}
      {open &&
        createPortal(
          <Dialog open={open} onOpenChange={close} title={title} description={description}>
            {done ? (
              <div className="flex flex-col gap-4">
                <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-[#22603F]">
                  {done}
                </p>
                <Button type="button" variant="secondary" onClick={() => close(false)}>
                  Fechar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="reason">Motivo (fica na auditoria)</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="Ex.: o petshop pediu por WhatsApp para confirmar o contato do tutor."
                    className="focus-visible:ring-petrol"
                  />
                  <p className="mt-1 text-xs text-gray-neutral">Mínimo de 10 caracteres.</p>
                </div>
                {error && (
                  <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#9A3825]">
                    {error}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => close(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={confirm}
                    disabled={pending || reason.trim().length < 10}
                    className="bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol"
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : confirmLabel}
                  </Button>
                </div>
              </div>
            )}
          </Dialog>,
          document.body,
        )}
    </>
  );
}
