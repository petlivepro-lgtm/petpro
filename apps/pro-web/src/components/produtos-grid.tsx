"use client";

import { useCallback, useMemo, useState } from "react";
import { Package, SearchX } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  StatusChip,
  Tabs,
  type TabItem,
} from "@mylivepet/ui";
import {
  formatBRL,
  PRODUCT_CATEGORY_LABEL,
  type ProductCategory,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { ProductDialog, type ProductRow } from "@/components/product-dialog";
import { DeleteProductDialog } from "@/components/delete-product-dialog";
import {
  CatalogToolbar,
  matchesCatalogSearch,
  useCatalogView,
} from "@/components/catalog-toolbar";

const PRODUCT_SELECT =
  "id, name, description, category, price_cents, stock, min_stock, active, for_sale, photo_path, photos";
const VIEW_STORAGE_KEY = "mylivepet:pro:produtos:view";

type ProductFilter = "venda" | "interno" | "todos";

export function ProdutosGrid({
  initialProducts,
}: {
  initialProducts: ProductRow[];
}) {
  const fetchProducts = useCallback(async (): Promise<ProductRow[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product")
      .select(PRODUCT_SELECT)
      .order("name");
    return (data ?? []) as ProductRow[];
  }, []);

  const list = useRealtimeList(
    initialProducts,
    fetchProducts,
    [{ table: "product" }],
    "produtos-estoque",
  );

  const [filter, setFilter] = useState<ProductFilter>("venda");
  const [query, setQuery] = useState("");
  const [view, setView] = useCatalogView(VIEW_STORAGE_KEY);

  const tabs: TabItem[] = useMemo(() => {
    const venda = list.filter((product) => product.for_sale).length;
    const interno = list.length - venda;
    return [
      { id: "venda", label: `À venda (${venda})` },
      { id: "interno", label: `Uso interno (${interno})` },
      { id: "todos", label: `Todos (${list.length})` },
    ];
  }, [list]);

  const visible = useMemo(
    () =>
      list
        .filter((product) =>
          filter === "todos"
            ? true
            : filter === "venda"
              ? product.for_sale
              : !product.for_sale,
        )
        .filter((product) =>
          matchesCatalogSearch(
            [
              product.name,
              product.description,
              product.category
                ? (PRODUCT_CATEGORY_LABEL[
                    product.category as ProductCategory
                  ] ?? product.category)
                : "",
              product.for_sale ? "à venda venda" : "uso interno",
              product.for_sale ? formatBRL(product.price_cents) : "sem preço",
              `${product.stock} un unidades`,
              getStockLabel(product),
              product.active ? "ativo" : "inativo",
            ],
            query,
          ),
        ),
    [filter, list, query],
  );

  return (
    <div>
      <Tabs
        tabs={tabs}
        active={filter}
        onChange={(id) => setFilter(id as ProductFilter)}
        className="mb-4"
      />
      <CatalogToolbar
        query={query}
        onQueryChange={setQuery}
        view={view}
        onViewChange={setView}
        searchLabel="Buscar produtos"
        placeholder="Buscar produtos..."
      />

      {visible.length === 0 ? (
        <ProductsEmptyState
          query={query}
          filter={filter}
          totalCount={list.length}
          onClearQuery={() => setQuery("")}
          onShowAll={() => setFilter("todos")}
        />
      ) : view === "cards" ? (
        <ProductsCards products={visible} />
      ) : (
        <ProductsTable products={visible} />
      )}
    </div>
  );
}

function ProductsCards({ products }: { products: ProductRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <Card key={product.id} className="flex flex-col">
          <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/50">
            <ProductImage product={product} iconClassName="h-8 w-8" />
          </div>
          <div className="flex items-start justify-between gap-2">
            <p className="font-heading font-semibold text-graphite">
              {product.name}
            </p>
            <ProductStockStatus product={product} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="text-xs text-gray-neutral">
                {PRODUCT_CATEGORY_LABEL[product.category as ProductCategory] ??
                  product.category}
              </span>
            )}
            {!product.for_sale && (
              <StatusChip tone="info">Uso interno</StatusChip>
            )}
          </div>
          <p className="mt-2 font-heading text-xl font-bold text-graphite">
            {product.for_sale ? formatBRL(product.price_cents) : "—"}
          </p>
          <ProductActions product={product} />
        </Card>
      ))}
    </div>
  );
}

function ProductsTable({ products }: { products: ProductRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <caption className="sr-only">Catálogo de produtos</caption>
          <thead className="bg-surface-muted text-xs uppercase tracking-wide text-gray-neutral">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Produto
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Categoria
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Tipo
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Preço
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Estoque
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/5">
            {products.map((product) => (
              <tr
                key={product.id}
                className="transition-colors hover:bg-surface-muted/60"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/50">
                      <ProductImage product={product} iconClassName="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-heading font-semibold text-graphite">
                        {product.name}
                      </p>
                      {product.description && (
                        <p className="mt-0.5 max-w-xs text-xs text-gray-neutral">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-gray-neutral">
                  {product.category
                    ? (PRODUCT_CATEGORY_LABEL[
                        product.category as ProductCategory
                      ] ?? product.category)
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusChip tone={product.for_sale ? "success" : "info"}>
                    {product.for_sale ? "À venda" : "Uso interno"}
                  </StatusChip>
                </td>
                <td className="whitespace-nowrap px-4 py-4 font-heading font-semibold text-graphite">
                  {product.for_sale ? formatBRL(product.price_cents) : "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <ProductStockStatus product={product} />
                </td>
                <td className="whitespace-nowrap px-4 py-4">
                  <StatusChip tone={product.active ? "success" : "danger"}>
                    {product.active ? "Ativo" : "Inativo"}
                  </StatusChip>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <ProductDialog product={product} />
                    <DeleteProductDialog
                      productId={product.id}
                      productName={product.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductImage({
  product,
  iconClassName,
}: {
  product: ProductRow;
  iconClassName: string;
}) {
  return product.photo_path ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.photo_path}
      alt={product.name}
      className="h-full w-full object-cover"
    />
  ) : (
    <Package className={iconClassName} />
  );
}

function ProductStockStatus({ product }: { product: ProductRow }) {
  return (
    <StatusChip
      tone={
        product.stock <= 0
          ? "danger"
          : product.min_stock > 0 && product.stock <= product.min_stock
            ? "warning"
            : "success"
      }
    >
      {getStockLabel(product)}
    </StatusChip>
  );
}

function getStockLabel(product: ProductRow) {
  if (product.stock <= 0) return "Esgotado";
  if (product.min_stock > 0 && product.stock <= product.min_stock) {
    return `${product.stock} un. · baixo`;
  }
  return `${product.stock} un.`;
}

function ProductActions({ product }: { product: ProductRow }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
      {!product.active && (
        <span className="text-xs text-gray-neutral">Inativo</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <ProductDialog product={product} />
        <DeleteProductDialog
          productId={product.id}
          productName={product.name}
        />
      </div>
    </div>
  );
}

function ProductsEmptyState({
  query,
  filter,
  totalCount,
  onClearQuery,
  onShowAll,
}: {
  query: string;
  filter: ProductFilter;
  totalCount: number;
  onClearQuery: () => void;
  onShowAll: () => void;
}) {
  if (totalCount === 0) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" />}
        title="Nenhum produto cadastrado"
        description="Cadastre o primeiro produto para exibir no app dos tutores."
        action={<ProductDialog />}
      />
    );
  }

  if (query.trim()) {
    return (
      <EmptyState
        icon={<SearchX className="h-6 w-6" />}
        title="Nenhum produto encontrado"
        description={`Não encontramos resultados para “${query.trim()}” neste filtro.`}
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClearQuery}
          >
            Limpar busca
          </Button>
        }
      />
    );
  }

  const label = filter === "venda" ? "à venda" : "de uso interno";
  return (
    <EmptyState
      icon={<Package className="h-6 w-6" />}
      title={`Nenhum produto ${label}`}
      description="Há produtos cadastrados, mas nenhum pertence a esta categoria."
      action={
        <Button type="button" variant="secondary" size="sm" onClick={onShowAll}>
          Ver todos os produtos
        </Button>
      }
    />
  );
}
