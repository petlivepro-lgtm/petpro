"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, CurrencyInput, Dialog, Input, Label, PhotoGalleryInput, Select } from "@mylivepet/ui";
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
  active: boolean;
  photo_path: string | null;
  photos: string[];
};

export function ProductDialog({ product }: { product?: ProductRow }) {
  const router = useRouter();
  const isEdit = !!product;
  const [open, setOpen] = useState(false);
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
        description="Disponível para reserva no MyLivePet (pagamento na loja)."
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
              <Label htmlFor="price">Preço *</Label>
              <CurrencyInput id="price" name="price" required defaultCents={product?.price_cents} />
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
            <Label>Fotos (até 5)</Label>
            <PhotoGalleryInput name="photos" defaultUrls={product?.photos ?? []} max={5} />
          </div>

          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product ? product.active : true}
              className="h-4 w-4 accent-orange"
            />
            Ativo (visível no app)
          </label>

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
