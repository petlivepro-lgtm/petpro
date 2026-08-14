"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Checkbox, Dialog, Input, Label } from "@mylivepet/ui";
import { upsertPaymentTerminal, type FormState } from "./actions";

export type TerminalFormValues = {
  id: string;
  name: string;
  active: boolean;
  is_default: boolean;
};

/** Cadastro da maquininha. Sem `terminal`, cria uma nova. */
export function TerminalDialog({
  terminal,
}: {
  terminal?: TerminalFormValues;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    upsertPaymentTerminal,
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
      {terminal ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${terminal.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova maquininha
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={terminal ? "Editar maquininha" : "Nova maquininha"}
        description="O nome da operadora ajuda a conferir o extrato: Stone, Cielo, PagSeguro, InfinitePay..."
      >
        {/* key remonta o form a cada abertura para não guardar rascunho antigo */}
        <form key={String(open)} action={formAction} className="space-y-4">
          {terminal && <input type="hidden" name="id" value={terminal.id} />}

          <div>
            <Label htmlFor="terminal-name">Nome *</Label>
            <Input
              id="terminal-name"
              name="name"
              required
              maxLength={60}
              defaultValue={terminal?.name ?? ""}
              placeholder="Ex.: Stone (balcão)"
            />
          </div>

          <div className="space-y-3 rounded-xl bg-surface-muted p-4">
            <Checkbox
              name="active"
              defaultChecked={terminal?.active ?? true}
              label="Maquininha em uso"
            />
            <Checkbox
              name="is_default"
              defaultChecked={terminal?.is_default ?? false}
              label={
                <span>
                  Usar como padrão nas vendas
                  <span className="block text-xs text-gray-neutral">
                    Vem pré-selecionada no cartão e no Pix. Só uma pode ser a
                    padrão.
                  </span>
                </span>
              }
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
