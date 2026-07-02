"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Checkbox, CurrencyInput, Dialog, Input, Label, PhotoGalleryInput, Select } from "@mylivepet/ui";
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL } from "@mylivepet/types";
import {
  createProduct,
  updateProduct,
  type FormState,
} from "@/app/(app)/produtos/actions";

export type ProductRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price_cents: number;
  stock: number;
  min_stock: number;
  active: boolean;
  for_sale: boolean;
  photo_path: string | null;
  photos: string[];
};

export function ProductDialog({ product }: { product?: ProductRow }) {
  const router = useRouter();
  const isEdit = !!product;
  const [open, setOpen] = useState(false);
  const [forSale, setForSale] = useState(product?.for_sale ?? true);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateProduct : createProduct,
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
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${product!.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo produto
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar produto" : "Novo produto"}
        description="À venda no MyLivePet ou de uso interno do petshop (estoque)."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={product!.id} />}

          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required defaultValue={product?.name} placeholder="Ex.: Ração Premium 1kg" />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              defaultValue={product?.description ?? ""}
              placeholder="Opcional"
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria *</Label>
            <Select id="category" name="category" required defaultValue={product?.category ?? ""}>
              <option value="" disabled>
                Selecione uma categoria
              </option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {PRODUCT_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="price">Preço {forSale ? "*" : "(opcional)"}</Label>
              <CurrencyInput id="price" name="price" required={forSale} defaultCents={product?.price_cents} />
            </div>
            <div>
              <Label htmlFor="stock">Estoque (un.) *</Label>
              <Input
                id="stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={product ? String(product.stock) : ""}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="min_stock">Estoque mínimo (alerta)</Label>
            <Input
              id="min_stock"
              name="min_stock"
              type="number"
              min="0"
              step="1"
              defaultValue={product ? String(product.min_stock) : "0"}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Fotos (até 5)</Label>
            <PhotoGalleryInput name="photos" defaultUrls={product?.photos ?? []} max={5} />
          </div>

          <div className="space-y-3 rounded-xl border border-graphite/10 p-3">
            <Checkbox
              name="for_sale"
              checked={forSale}
              onChange={(e) => setForSale(e.target.checked)}
              className="flex items-start [&>span:first-of-type]:mt-0.5"
              label={
                <>
                  Disponível para venda no app dos tutores
                  <span className="mt-0.5 block text-xs text-gray-neutral">
                    Desmarque para itens de uso interno (limpeza, shampoo próprio, insumos): entram
                    só no controle de estoque.
                  </span>
                </>
              }
            />

            <Checkbox
              name="active"
              defaultChecked={product ? product.active : true}
              label="Ativo"
            />
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
