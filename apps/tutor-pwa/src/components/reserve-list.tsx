"use client";

import { useState } from "react";
import { Button, Card, Badge, Dialog, PhotoGallery } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { createReservation } from "@/app/(app)/actions";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price_cents: number;
  stock: number;
  photo_path?: string | null;
  photos?: string[];
};

function photosOf(p: Product): string[] {
  if (p.photos && p.photos.length > 0) return p.photos;
  return p.photo_path ? [p.photo_path] : [];
}

export function ReserveList({ products }: { products: Product[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);

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

  function Stepper({ p }: { p: Product }) {
    return (
      <div className="flex items-center gap-2">
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

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const cover = photosOf(p)[0];
          return (
            <Card
              key={p.id}
              onClick={() => setOpenId(p.id)}
              className="flex cursor-pointer items-center justify-between gap-3 p-4 transition-shadow hover:shadow-card-hover"
            >
              <div className="flex min-w-0 items-center gap-3">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={p.name}
                    className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium text-graphite">{p.name}</p>
                  <p className="text-sm text-gray-neutral">{formatBRL(p.price_cents)}</p>
                  {p.stock <= 0 && (
                    <Badge tone="danger" className="mt-1">
                      Sem estoque
                    </Badge>
                  )}
                </div>
              </div>
              <Stepper p={p} />
            </Card>
          );
        })}
      </div>

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
              <p className="text-sm text-gray-neutral">{opened.description}</p>
            )}
            <div className="flex items-center justify-between border-t border-graphite/5 pt-4">
              <span className="text-sm font-medium text-graphite">Quantidade</span>
              <Stepper p={opened} />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
