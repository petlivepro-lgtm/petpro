"use client";

import { useCallback, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { Card, StatusChip, Tabs, type TabItem } from "@mylivepet/ui";
import { formatBRL, PRODUCT_CATEGORY_LABEL, type ProductCategory } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { ProductDialog, type ProductRow } from "@/components/product-dialog";
import { DeleteProductDialog } from "@/components/delete-product-dialog";

const PRODUCT_SELECT =
  "id, name, description, category, price_cents, stock, min_stock, active, for_sale, photo_path, photos";

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

  const [filter, setFilter] = useState<"venda" | "interno" | "todos">("venda");
  const tabs: TabItem[] = useMemo(() => {
    const venda = list.filter((p) => p.for_sale).length;
    const interno = list.length - venda;
    return [
      { id: "venda", label: `À venda (${venda})` },
      { id: "interno", label: `Uso interno (${interno})` },
      { id: "todos", label: `Todos (${list.length})` },
    ];
  }, [list]);

  const visible = list.filter((p) =>
    filter === "todos" ? true : filter === "venda" ? p.for_sale : !p.for_sale,
  );

  return (
    <div>
      <Tabs
        tabs={tabs}
        active={filter}
        onChange={(id) => setFilter(id as typeof filter)}
        className="mb-4"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((p) => (
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
            <StatusChip
              tone={
                p.stock <= 0
                  ? "danger"
                  : p.min_stock > 0 && p.stock <= p.min_stock
                    ? "warning"
                    : "success"
              }
            >
              {p.stock <= 0
                ? "Esgotado"
                : p.min_stock > 0 && p.stock <= p.min_stock
                  ? `${p.stock} un. · baixo`
                  : `${p.stock} un.`}
            </StatusChip>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {p.category && (
              <span className="text-xs text-gray-neutral">
                {PRODUCT_CATEGORY_LABEL[p.category as ProductCategory] ?? p.category}
              </span>
            )}
            {!p.for_sale && <StatusChip tone="info">Uso interno</StatusChip>}
          </div>
          <p className="mt-2 font-heading text-xl font-bold text-graphite">
            {p.for_sale ? formatBRL(p.price_cents) : "—"}
          </p>
          <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
            {!p.active && <span className="text-xs text-gray-neutral">Inativo</span>}
            <div className="ml-auto flex items-center gap-1">
              <ProductDialog product={p} />
              <DeleteProductDialog productId={p.id} productName={p.name} />
            </div>
          </div>
        </Card>
      ))}
      </div>
    </div>
  );
}
