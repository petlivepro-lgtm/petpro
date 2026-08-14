"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deletePaymentTerminal, type FormState } from "./actions";

export function DeleteTerminalDialog({
  terminalId,
  name,
}: {
  terminalId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deletePaymentTerminal,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir maquininha?"
        description={name}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={terminalId} />
          <p className="text-sm text-graphite">
            As taxas cadastradas são apagadas. As vendas já registradas mantêm a
            taxa e o nome da maquininha no financeiro — o histórico não muda. Se
            a intenção é só parar de usar, desative em vez de excluir.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
