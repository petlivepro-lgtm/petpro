"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp } from "lucide-react";
import { Button, Dialog, Input, Label, Select } from "@mylivepet/ui";
import { STOCK_MOVEMENT_TYPES, STOCK_MOVEMENT_TYPE_LABEL } from "@mylivepet/types";
import { registerStockMovement, type FormState } from "@/app/(app)/financeiro/actions";

export type StockProductOption = { id: string; name: string; stock: number };

export function StockMovementDialog({ products }: { products: StockProductOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerStockMovement,
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <ArrowDownUp className="h-4 w-4" /> Registrar movimentação
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Movimentação de estoque"
        description="Entrada (compra, reposição) ou saída (venda no balcão, perda)."
      >
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="product_id">Produto *</Label>
            <Select id="product_id" name="product_id" required defaultValue="">
              <option value="" disabled>
                Selecione um produto
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.stock} un.
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select id="type" name="type" required defaultValue="IN">
                {STOCK_MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {STOCK_MOVEMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="1"
                step="1"
                required
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="note">Observação</Label>
            <Input id="note" name="note" placeholder="Ex.: Compra do fornecedor" />
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
