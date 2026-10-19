"use client";

import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button, Dialog, Input, Label } from "@mylivepet/ui";
import { stepUp } from "@/app/mfa/actions";

type Outcome = { ok: boolean; code?: string; error?: string };

/**
 * Ações de governança pedem o código do app de novo (vale 10 min). Quando a
 * action responde STEP_UP, abre este diálogo, confere o código e repete a
 * mesma action — a pessoa não perde o que preencheu.
 */
export function useStepUp() {
  const [retry, setRetry] = useState<(() => Promise<void>) | null>(null);

  async function run<T extends Outcome>(fn: () => Promise<T>, onResult: (r: T) => void) {
    const first = await fn();
    if (!first.ok && first.code === "STEP_UP") {
      setRetry(() => async () => onResult(await fn()));
      return;
    }
    onResult(first);
  }

  const dialog = (
    <StepUpDialog
      open={retry !== null}
      onCancel={() => setRetry(null)}
      onVerified={async () => {
        const again = retry;
        setRetry(null);
        await again?.();
      }}
    />
  );

  return { run, dialog };
}

function StepUpDialog({
  open,
  onCancel,
  onVerified,
}: {
  open: boolean;
  onCancel: () => void;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function close() {
    setCode("");
    setError(null);
    onCancel();
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const res = await stepUp(code);
      if (res.ok) {
        setCode("");
        await onVerified();
      } else {
        setError(res.error);
        setCode("");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : close())}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-petrol" aria-hidden /> Confirme com o código do app
        </span>
      }
      description="Ações de governança pedem o código de novo, mesmo com a sessão aberta. Vale por 10 minutos."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="step-up-code">Código de 6 dígitos</Label>
          <Input
            id="step-up-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            className="h-12 text-center font-accent text-xl tracking-[0.4em] focus-visible:ring-petrol"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-[#9A3825]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || code.length !== 6} className="bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Verificando" /> : "Confirmar"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
