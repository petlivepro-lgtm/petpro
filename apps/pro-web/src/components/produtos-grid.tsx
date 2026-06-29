"use client";

import { useCallback } from "react";
import { Package } from "lucide-react";
import { Card, StatusChip } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { ProductDialog, type ProductRow } from "@/components/product-dialog";
import { DeleteProductDialog } from "@/components/delete-product-dialog";

const PRODUCT_SELECT = "id, name, description, price_cents, stock, active, photo_path, photos";

export function ProdutosGrid({ initialProducts }: { initialProducts: ProductRow[] }) {
  const fetchProducts = useCallback(async (): Promise<ProductRow[]> => {
    const supabase = createClient();
    const { data } = await supabase.from("product").select(PRODUCT_SELECT).order("name");
    return (data ?? []) as ProductRow[];
  }, []);

  const list = useRealtimeList(
    initialProducts,
    fetchProducts,
    [{ table: "product" }],
    "produtos-estoque",
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((p) => (
        <Card key={p.id} className="flex flex-col">
          <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/50">
            {p.photo_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_path} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <Package className="h-8 w-8" />
            )}
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading font-semibold text-graphite">{p.name}</p>
            <StatusChip tone={p.stock > 0 ? "success" : "danger"}>
              {p.stock > 0 ? `${p.stock} un.` : "Esgotado"}
            </StatusChip>
          </div>
          <p className="mt-2 font-heading text-xl font-bold text-graphite">
            {formatBRL(p.price_cents)}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
            {!p.active && <span className="text-xs text-gray-neutral">Inativo (oculto no app)</span>}
            <div className="ml-auto flex items-center gap-1">
              <ProductDialog product={p} />
              <DeleteProductDialog productId={p.id} productName={p.name} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
