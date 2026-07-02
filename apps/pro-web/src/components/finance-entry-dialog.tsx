"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  CurrencyInput,
  DatePicker,
  Dialog,
  Input,
  Label,
  Select,
} from "@mylivepet/ui";
import {
  FINANCE_CATEGORIES,
  FINANCE_CATEGORY_LABEL,
  FINANCE_ENTRY_TYPES,
  FINANCE_ENTRY_TYPE_LABEL,
} from "@mylivepet/types";
import {
  createFinanceEntry,
  deleteFinanceEntry,
  type FormState,
} from "@/app/(app)/financeiro/actions";

const pad = (n: number) => String(n).padStart(2, "0");

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function FinanceEntryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(createFinanceEntry, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Novo lançamento"
        description="Registre uma receita ou despesa do petshop."
      >
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select id="type" name="type" required defaultValue="INCOME">
                {FINANCE_ENTRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FINANCE_ENTRY_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select id="category" name="category" defaultValue="">
                <option value="">Sem categoria</option>
                {FINANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {FINANCE_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              name="description"
              required
              placeholder="Ex.: Compra de ração para revenda"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Valor *</Label>
              <CurrencyInput id="amount" name="amount" required />
            </div>
            <div>
              <Label htmlFor="occurred_on">Data *</Label>
              <DatePicker id="occurred_on" name="occurred_on" mode="date" required defaultValue={todayIso()} />
            </div>
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
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

export function FinanceEntryDeleteButton({
  id,
  description,
}: {
  id: string;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteFinanceEntry, {
    ok: false,
  });

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
        aria-label={`Excluir ${description}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          title="Excluir lançamento"
          description={`Excluir "${description}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          confirmVariant="danger"
          confirmType="submit"
          pending={pending}
          pendingLabel="Excluindo..."
          error={state.error}
        />
      </form>
    </>
  );
}
