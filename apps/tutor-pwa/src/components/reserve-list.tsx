"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import { Button, Card, Badge, Dialog, Input, PhotoGallery } from "@mylivepet/ui";
import {
  formatBRL,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  type ProductCategory,
} from "@mylivepet/types";
import { createReservation } from "@/app/(app)/actions";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  stock: number;
  photo_path?: string | null;
  photos?: string[];
};

function categoryLabel(category?: string | null): string {
  if (!category) return "";
  return PRODUCT_CATEGORY_LABEL[category as ProductCategory] ?? category;
}

function photosOf(p: Product): string[] {
  if (p.photos && p.photos.length > 0) return p.photos;
  return p.photo_path ? [p.photo_path] : [];
}

export function ReserveList({ products }: { products: Product[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | null>(null);

  // Categorias presentes no catálogo, na ordem predefinida.
  const availableCategories = useMemo(() => {
    const present = new Set(products.map((p) => p.category).filter(Boolean));
    return PRODUCT_CATEGORIES.filter((c) => present.has(c));
  }, [products]);

  // Busca por nome do produto e categoria + filtro por categoria selecionada.
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        categoryLabel(p.category).toLowerCase().includes(term)
      );
    });
  }, [products, search, category]);

  const items = Object.entries(qty)
    .filter(([, q]) => q > 0)
    .map(([product_id, quantity]) => ({ product_id, quantity }));

  const total = items.reduce((sum, i) => {
    const p = products.find((x) => x.id === i.product_id);
    return sum + (p ? p.price_cents * i.quantity : 0);
  }, 0);

  function setQ(id: string, delta: number, max: number) {
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[id] ?? 0) + delta));
      return { ...prev, [id]: next };
    });
  }

  const opened = products.find((p) => p.id === openId) ?? null;

  function Stepper({ p, onClick }: { p: Product; onClick?: (e: React.MouseEvent) => void }) {
    return (
      <div className="flex items-center gap-2" onClick={onClick}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setQ(p.id, -1, p.stock);
          }}
          disabled={(qty[p.id] ?? 0) <= 0}
        >
          −
        </Button>
        <span className="w-6 text-center text-sm font-medium">{qty[p.id] ?? 0}</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setQ(p.id, 1, p.stock);
          }}
          disabled={p.stock <= 0 || (qty[p.id] ?? 0) >= p.stock}
        >
          +
        </Button>
      </div>
    );
  }

  const openedQty = opened ? (qty[opened.id] ?? 0) : 0;
  const openedSubtotal = opened ? opened.price_cents * openedQty : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou categoria"
            className="pl-9"
            aria-label="Buscar produtos"
          />
        </div>

        {availableCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory(null)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                category === null
                  ? "border-orange bg-orange text-white"
                  : "border-graphite/15 bg-surface text-graphite hover:border-orange/40"
              }`}
            >
              Todos
            </button>
            {availableCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === c
                    ? "border-orange bg-orange text-white"
                    : "border-graphite/15 bg-surface text-graphite hover:border-orange/40"
                }`}
              >
                {PRODUCT_CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-neutral">
          Nenhum produto encontrado.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
          const cover = photosOf(p)[0];
          const selected = (qty[p.id] ?? 0) > 0;
          return (
            <Card
              key={p.id}
              onClick={() => setOpenId(p.id)}
              className={`flex cursor-pointer flex-col gap-3 p-3 transition-shadow hover:shadow-card-hover ${
                selected ? "ring-2 ring-orange/40" : ""
              }`}
            >
              <div className="relative flex h-36 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/40">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-9 w-9" />
                )}
                {p.stock <= 0 && (
                  <span className="absolute right-2 top-2">
                    <Badge tone="danger">Sem estoque</Badge>
                  </span>
                )}
              </div>

              <div className="flex min-h-[2.5rem] flex-col">
                <p className="line-clamp-2 font-medium leading-tight text-graphite">{p.name}</p>
                {p.category && (
                  <span className="mt-1 text-xs text-gray-neutral">{categoryLabel(p.category)}</span>
                )}
                <p className="mt-1 font-heading text-base font-bold text-graphite">
                  {formatBRL(p.price_cents)}
                </p>
              </div>

              <div className="mt-auto flex items-center justify-between">
                {p.stock > 0 ? (
                  <span className="text-xs text-gray-neutral">{p.stock} em estoque</span>
                ) : (
                  <span className="text-xs text-danger">Indisponível</span>
                )}
                <Stepper p={p} onClick={(e) => e.stopPropagation()} />
              </div>
            </Card>
          );
          })}
        </div>
      )}

      <form action={createReservation} className="space-y-3">
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <div className="flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
          <span className="text-sm text-gray-neutral">Total a pagar na loja</span>
          <span className="font-heading text-lg font-bold text-graphite">{formatBRL(total)}</span>
        </div>
        <Button type="submit" className="w-full" disabled={items.length === 0}>
          Reservar para retirar na loja
        </Button>
        <p className="text-center text-xs text-gray-neutral">
          O pagamento é feito presencialmente. A reserva vale por 48h.
        </p>
      </form>

      <Dialog open={!!opened} onOpenChange={(v) => !v && setOpenId(null)} title={opened?.name}>
        {opened && (
          <div className="space-y-4">
            <PhotoGallery photos={photosOf(opened)} alt={opened.name} />

            <div className="flex items-center justify-between gap-3">
              <span className="font-heading text-2xl font-bold text-graphite">
                {formatBRL(opened.price_cents)}
              </span>
              {opened.stock > 0 ? (
                <Badge tone="success">{opened.stock} em estoque</Badge>
              ) : (
                <Badge tone="danger">Sem estoque</Badge>
              )}
            </div>

            {opened.description && (
              <p className="text-sm leading-relaxed text-gray-neutral">{opened.description}</p>
            )}

            <div className="space-y-3 rounded-2xl bg-surface-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-graphite">Quantidade</span>
                <Stepper p={opened} />
              </div>
              <div className="flex items-center justify-between border-t border-graphite/5 pt-3">
                <span className="text-sm text-gray-neutral">Subtotal</span>
                <span className="font-heading text-lg font-bold text-graphite">
                  {formatBRL(openedSubtotal)}
                </span>
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={opened.stock <= 0}
              onClick={() => {
                if (openedQty === 0) setQ(opened.id, 1, opened.stock);
                setOpenId(null);
              }}
            >
              Adicionar à reserva
            </Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
