"use client";

import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";
import {
  Button,
  Card,
  Badge,
  ChoiceChips,
  ColorSwatchInput,
  Dialog,
  Input,
  Label,
  PhotoGallery,
} from "@mylivepet/ui";
import {
  formatBRL,
  formatWeight,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  PRODUCT_COLOR_HEX,
  type ProductCategory,
} from "@mylivepet/types";
import { createReservation } from "@/app/(app)/actions";

export type ProductVariant = {
  id: string;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  weight_value: number | string | null;
  weight_unit: string | null;
  price_cents: number;
  stock: number;
  position: number;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  stock: number;
  photo_path?: string | null;
  photos?: string[];
  product_variant?: ProductVariant[];
};

/** Escolha em andamento no diálogo de um produto com variações. */
type VariantChoice = { color: string | null; size: string | null; weight: string | null };

const EMPTY_CHOICE: VariantChoice = { color: null, size: null, weight: null };

function categoryLabel(category?: string | null): string {
  if (!category) return "";
  return PRODUCT_CATEGORY_LABEL[category as ProductCategory] ?? category;
}

function photosOf(p: Product): string[] {
  if (p.photos && p.photos.length > 0) return p.photos;
  return p.photo_path ? [p.photo_path] : [];
}

function variantsOf(p: Product): ProductVariant[] {
  return [...(p.product_variant ?? [])].sort((a, b) => a.position - b.position);
}

/** Chave de peso usada nos chips ("500 g"); identifica valor + unidade juntos. */
function weightKey(v: ProductVariant): string | null {
  return formatWeight(v.weight_value, v.weight_unit);
}

/** Chave do carrinho: cada variação é um item próprio. */
function cartKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId;
}

/** Menor preço entre as variações com estoque (ou entre todas, se esgotado). */
function priceFrom(p: Product): number {
  const variants = variantsOf(p);
  if (variants.length === 0) return p.price_cents;
  const withStock = variants.filter((v) => v.stock > 0);
  const pool = withStock.length > 0 ? withStock : variants;
  return Math.min(...pool.map((v) => v.price_cents));
}

export function ReserveList({ products }: { products: Product[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [choice, setChoice] = useState<VariantChoice>(EMPTY_CHOICE);
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

  // Índice das linhas do carrinho para montar o payload e somar o total.
  const cartRows = useMemo(() => {
    const rows: { product: Product; variant: ProductVariant | null; quantity: number }[] = [];
    for (const [key, quantity] of Object.entries(qty)) {
      if (quantity <= 0) continue;
      const [productId, variantId] = key.split(":");
      const product = products.find((p) => p.id === productId);
      if (!product) continue;
      const variant = variantId
        ? (variantsOf(product).find((v) => v.id === variantId) ?? null)
        : null;
      if (variantId && !variant) continue;
      rows.push({ product, variant, quantity });
    }
    return rows;
  }, [qty, products]);

  const items = cartRows.map((r) => ({
    product_id: r.product.id,
    variant_id: r.variant?.id,
    quantity: r.quantity,
  }));

  const total = cartRows.reduce(
    (sum, r) => sum + (r.variant?.price_cents ?? r.product.price_cents) * r.quantity,
    0,
  );

  function setQ(key: string, delta: number, max: number) {
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  }

  const opened = products.find((p) => p.id === openId) ?? null;
  const openedVariants = opened ? variantsOf(opened) : [];

  function openProduct(p: Product) {
    setChoice(EMPTY_CHOICE);
    setOpenId(p.id);
  }

  function Stepper({
    cartId,
    max,
    onClick,
  }: {
    cartId: string;
    max: number;
    onClick?: (e: React.MouseEvent) => void;
  }) {
    return (
      <div className="flex items-center gap-2" onClick={onClick}>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setQ(cartId, -1, max);
          }}
          disabled={(qty[cartId] ?? 0) <= 0}
        >
          −
        </Button>
        <span className="w-6 text-center text-sm font-medium">{qty[cartId] ?? 0}</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            setQ(cartId, 1, max);
          }}
          disabled={max <= 0 || (qty[cartId] ?? 0) >= max}
        >
          +
        </Button>
      </div>
    );
  }

  // --- Estado do diálogo com variações --------------------------------------
  // As opções de cada eixo saem das variações cadastradas; combinações que não
  // existem ou estão esgotadas aparecem desabilitadas.
  const matching = openedVariants.filter(
    (v) =>
      (!choice.color || v.color_name === choice.color) &&
      (!choice.size || v.size === choice.size) &&
      (!choice.weight || weightKey(v) === choice.weight),
  );

  /** Uma variação só é "escolhida" quando os eixos disponíveis apontam para uma. */
  const chosenVariant = matching.length === 1 ? matching[0] : null;

  function axisOptions<T extends string>(
    values: (v: ProductVariant) => T | null,
    axis: keyof VariantChoice,
  ) {
    const seen = new Map<T, boolean>();
    for (const v of openedVariants) {
      const value = values(v);
      if (value === null) continue;
      // Disponível se combina com as outras escolhas e tem estoque.
      const fitsOthers = (Object.keys(choice) as (keyof VariantChoice)[])
        .filter((k) => k !== axis)
        .every((k) => {
          const picked = choice[k];
          if (!picked) return true;
          if (k === "color") return v.color_name === picked;
          if (k === "size") return v.size === picked;
          return weightKey(v) === picked;
        });
      const available = fitsOthers && v.stock > 0;
      seen.set(value, (seen.get(value) ?? false) || available);
    }
    return [...seen.entries()].map(([value, available]) => ({ value, available }));
  }

  const colorOptions = opened ? axisOptions((v) => v.color_name, "color") : [];
  const sizeOptions = opened ? axisOptions((v) => v.size, "size") : [];
  const weightOptions = opened ? axisOptions((v) => weightKey(v), "weight") : [];

  const openedHasVariants = openedVariants.length > 0;
  const openedUnitPrice = openedHasVariants
    ? (chosenVariant?.price_cents ?? (opened ? priceFrom(opened) : 0))
    : (opened?.price_cents ?? 0);
  const openedStock = openedHasVariants
    ? (chosenVariant?.stock ?? matching.reduce((s, v) => s + v.stock, 0))
    : (opened?.stock ?? 0);
  const openedCartId = opened
    ? cartKey(opened.id, openedHasVariants ? chosenVariant?.id : null)
    : "";
  const openedQty = openedCartId ? (qty[openedCartId] ?? 0) : 0;
  const openedSubtotal = openedUnitPrice * openedQty;
  const canAdd = openedHasVariants ? !!chosenVariant && openedStock > 0 : openedStock > 0;

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
          <ChoiceChips
            aria-label="Filtrar por categoria"
            allowEmpty={false}
            value={category ?? "todos"}
            onChange={(v) => setCategory(v === "todos" ? null : (v as ProductCategory))}
            options={[
              { value: "todos", label: "Todos" },
              ...availableCategories.map((c) => ({
                value: c,
                label: PRODUCT_CATEGORY_LABEL[c],
              })),
            ]}
          />
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
          const variants = variantsOf(p);
          const hasVariants = variants.length > 0;
          const selected = Object.entries(qty).some(
            ([key, q]) => q > 0 && (key === p.id || key.startsWith(`${p.id}:`)),
          );
          return (
            <Card
              key={p.id}
              onClick={() => openProduct(p)}
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
                  {hasVariants && (
                    <span className="mr-1 text-xs font-normal text-gray-neutral">a partir de</span>
                  )}
                  {formatBRL(priceFrom(p))}
                </p>
                {hasVariants && (
                  <span className="mt-1 text-xs text-gray-neutral">
                    {variantAxesLabel(variants)}
                  </span>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between">
                {p.stock > 0 ? (
                  <span className="text-xs text-gray-neutral">{p.stock} em estoque</span>
                ) : (
                  <span className="text-xs text-danger">Indisponível</span>
                )}
                {hasVariants ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={p.stock <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      openProduct(p);
                    }}
                  >
                    Escolher
                  </Button>
                ) : (
                  <Stepper
                    cartId={p.id}
                    max={p.stock}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
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
                {openedHasVariants && !chosenVariant && (
                  <span className="mr-1 text-sm font-normal text-gray-neutral">a partir de</span>
                )}
                {formatBRL(openedUnitPrice)}
              </span>
              {openedStock > 0 ? (
                <Badge tone="success">{openedStock} em estoque</Badge>
              ) : (
                <Badge tone="danger">Sem estoque</Badge>
              )}
            </div>

            {opened.description && (
              <p className="text-sm leading-relaxed text-gray-neutral">{opened.description}</p>
            )}

            {openedHasVariants && (
              <div className="space-y-3 rounded-2xl border border-graphite/10 p-4">
                {colorOptions.length > 0 && (
                  <div>
                    <Label>Cor</Label>
                    <ColorSwatchInput
                      aria-label="Cor"
                      value={choice.color}
                      options={colorOptions.map((o) => ({
                        name: o.value,
                        hex: PRODUCT_COLOR_HEX[o.value] ?? "#9CA3AF",
                      }))}
                      disabledColors={colorOptions
                        .filter((o) => !o.available)
                        .map((o) => o.value)}
                      onChange={(color) =>
                        setChoice((c) => ({ ...c, color: color?.name ?? null }))
                      }
                    />
                  </div>
                )}

                {sizeOptions.length > 0 && (
                  <div>
                    <Label>Tamanho</Label>
                    <ChoiceChips
                      aria-label="Tamanho"
                      value={choice.size}
                      options={sizeOptions.map((o) => ({
                        value: o.value,
                        label: o.value,
                        disabled: !o.available,
                      }))}
                      onChange={(size) => setChoice((c) => ({ ...c, size }))}
                    />
                  </div>
                )}

                {weightOptions.length > 0 && (
                  <div>
                    <Label>Peso</Label>
                    <ChoiceChips
                      aria-label="Peso"
                      value={choice.weight}
                      options={weightOptions.map((o) => ({
                        value: o.value,
                        label: o.value,
                        disabled: !o.available,
                      }))}
                      onChange={(weight) => setChoice((c) => ({ ...c, weight }))}
                    />
                  </div>
                )}

                {!chosenVariant && (
                  <p className="text-xs text-gray-neutral">
                    Escolha uma opção de cada campo para reservar.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3 rounded-2xl bg-surface-muted p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-graphite">Quantidade</span>
                {canAdd ? (
                  <Stepper cartId={openedCartId} max={openedStock} />
                ) : (
                  <span className="text-xs text-gray-neutral">
                    {openedHasVariants ? "Escolha a variação" : "Indisponível"}
                  </span>
                )}
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
              disabled={!canAdd}
              onClick={() => {
                if (openedQty === 0) setQ(openedCartId, 1, openedStock);
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

/** Resumo dos eixos usados pelo produto: "Cor · Tamanho · Peso". */
function variantAxesLabel(variants: ProductVariant[]): string {
  const axes: string[] = [];
  if (variants.some((v) => v.color_name)) axes.push("Cor");
  if (variants.some((v) => v.size)) axes.push("Tamanho");
  if (variants.some((v) => v.weight_value != null)) axes.push("Peso");
  return axes.join(" · ");
}
