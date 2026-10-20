"use client";

import { useMemo, useState } from "react";
import { Minus, Package, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import {
  Button,
  Badge,
  ChoiceChips,
  ColorSwatchInput,
  Dialog,
  EmptyState,
  Input,
  Label,
  PhotoGallery,
  Select,
  Textarea,
  cn,
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

type SortKey = "nome" | "menor" | "maior";

/** Abaixo disso o card avisa que está acabando. */
const LOW_STOCK = 5;

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

/** "Azul · M · 500 g" — a variação escolhida, como aparece na sacola. */
function variantLabel(v: ProductVariant): string {
  return [v.color_name, v.size, weightKey(v)].filter(Boolean).join(" · ");
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

/** − quantidade + */
function QtyStepper({
  value,
  max,
  onChange,
  label,
  className,
}: {
  value: number;
  max: number;
  onChange: (delta: number) => void;
  /** Nome do item, para os leitores de tela. */
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center justify-between rounded-xl border border-graphite/10 bg-surface",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(-1)}
        disabled={value <= 0}
        aria-label={`Diminuir ${label}`}
        className="flex h-full w-9 items-center justify-center rounded-l-xl text-graphite transition-colors hover:bg-surface-muted disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="min-w-[1.5rem] text-center text-sm font-semibold tabular-nums text-graphite" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(1)}
        disabled={max <= 0 || value >= max}
        aria-label={`Aumentar ${label}`}
        className="flex h-full w-9 items-center justify-center rounded-r-xl text-graphite transition-colors hover:bg-surface-muted disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * A loja do petshop no app do tutor: vitrine, sacola e o envio da reserva.
 * Nada é pago aqui — a reserva separa os produtos e o tutor paga ao retirar.
 */
export function ReserveList({
  products,
  toolbarAction,
}: {
  products: Product[];
  /** Ação ao lado da busca (o botão "Minhas reservas"). */
  toolbarAction?: React.ReactNode;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [choice, setChoice] = useState<VariantChoice>(EMPTY_CHOICE);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [sort, setSort] = useState<SortKey>("nome");
  const [cartOpen, setCartOpen] = useState(false);
  const [note, setNote] = useState("");

  // Categorias presentes no catálogo, na ordem predefinida.
  const availableCategories = useMemo(() => {
    const present = new Set(products.map((p) => p.category).filter(Boolean));
    return PRODUCT_CATEGORIES.filter((c) => present.has(c));
  }, [products]);

  // Busca por nome do produto e categoria + filtro por categoria selecionada.
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (!term) return true;
      return (
        p.name.toLowerCase().includes(term) ||
        categoryLabel(p.category).toLowerCase().includes(term)
      );
    });
    if (sort === "nome") return list;
    return [...list].sort((a, b) =>
      sort === "menor" ? priceFrom(a) - priceFrom(b) : priceFrom(b) - priceFrom(a),
    );
  }, [products, search, category, sort]);

  // Índice das linhas do carrinho para montar o payload e somar o total.
  const cartRows = useMemo(() => {
    const rows: {
      key: string;
      product: Product;
      variant: ProductVariant | null;
      quantity: number;
    }[] = [];
    for (const [key, quantity] of Object.entries(qty)) {
      if (quantity <= 0) continue;
      const [productId, variantId] = key.split(":");
      const product = products.find((p) => p.id === productId);
      if (!product) continue;
      const variant = variantId
        ? (variantsOf(product).find((v) => v.id === variantId) ?? null)
        : null;
      if (variantId && !variant) continue;
      rows.push({ key, product, variant, quantity });
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
  const itemCount = cartRows.reduce((sum, r) => sum + r.quantity, 0);

  function setQ(key: string, delta: number, max: number) {
    setQty((prev) => {
      const next = Math.max(0, Math.min(max, (prev[key] ?? 0) + delta));
      return { ...prev, [key]: next };
    });
  }

  function removeFromCart(key: string) {
    setQty((prev) => ({ ...prev, [key]: 0 }));
  }

  const opened = products.find((p) => p.id === openId) ?? null;
  const openedVariants = opened ? variantsOf(opened) : [];

  function openProduct(p: Product) {
    setChoice(EMPTY_CHOICE);
    setOpenId(p.id);
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

  /**
   * A sacola, usada na coluna do desktop e no diálogo do celular. É uma função
   * (e não um componente) para o campo de observação não perder o foco a cada
   * tecla: os dois lugares compartilham o mesmo estado.
   */
  function renderCart(withTitle: boolean) {
    return (
      <form action={createReservation} className="space-y-4">
        <input type="hidden" name="items" value={JSON.stringify(items)} />

        {withTitle && (
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold text-graphite">Sua sacola</h2>
            {itemCount > 0 && (
              <span className="text-sm text-gray-neutral">
                {itemCount} {itemCount === 1 ? "item" : "itens"}
              </span>
            )}
          </div>
        )}

        {cartRows.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl bg-surface-muted px-4 py-6 text-center">
            <ShoppingBag className="h-6 w-6 text-gray-neutral/60" aria-hidden />
            <p className="mt-2 text-sm font-medium text-graphite">Sua sacola está vazia</p>
            <p className="mt-0.5 text-xs text-gray-neutral">
              Adicione produtos para reservar e retirar na loja.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-graphite/5">
            {cartRows.map((r) => {
              const unit = r.variant?.price_cents ?? r.product.price_cents;
              const max = r.variant?.stock ?? r.product.stock;
              const cover = photosOf(r.product)[0];
              return (
                <li key={r.key} className="flex gap-3 py-3 first:pt-0">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-gray-neutral/40">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-graphite">
                        {r.product.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(r.key)}
                        aria-label={`Tirar ${r.product.name} da sacola`}
                        className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {r.variant && (
                      <p className="text-xs text-gray-neutral">{variantLabel(r.variant)}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <QtyStepper
                        value={r.quantity}
                        max={max}
                        label={r.product.name}
                        onChange={(delta) => setQ(r.key, delta, max)}
                        className="h-8 w-[6.5rem]"
                      />
                      <span className="text-sm font-semibold tabular-nums text-graphite">
                        {formatBRL(unit * r.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {cartRows.length > 0 && (
          <div>
            <Label htmlFor={withTitle ? "note-lateral" : "note-sacola"}>
              Observação para a loja{" "}
              <span className="font-normal text-gray-neutral">(opcional)</span>
            </Label>
            <Textarea
              id={withTitle ? "note-lateral" : "note-sacola"}
              name="note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: retiro no sábado de manhã."
            />
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-graphite/5 pt-4">
          <span className="text-sm text-gray-neutral">Total a pagar na loja</span>
          <span className="font-heading text-xl font-bold tabular-nums text-graphite">
            {formatBRL(total)}
          </span>
        </div>
        <Button type="submit" className="w-full" disabled={items.length === 0}>
          Reservar para retirar na loja
        </Button>
        <p className="text-center text-xs text-gray-neutral">
          O pagamento é feito presencialmente. A reserva vale por 48h.
        </p>
      </form>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
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
          {products.length > 1 && (
            <div className="w-36 shrink-0 sm:w-44">
              <Select
                aria-label="Ordenar produtos"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                <option value="nome">Nome (A–Z)</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
              </Select>
            </div>
          )}
        </div>

        {(availableCategories.length > 0 || toolbarAction) && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            {availableCategories.length > 0 ? (
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
            ) : (
              <span />
            )}
            {toolbarAction}
          </div>
        )}

        {products.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="A loja ainda não tem produtos no app"
            description="Quando o petshop cadastrar produtos à venda, eles aparecem aqui para você reservar."
          />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Nenhum produto encontrado"
            description="Tente outra palavra ou veja todas as categorias."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory(null);
                }}
              >
                Limpar busca
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((p) => {
              const cover = photosOf(p)[0];
              const variants = variantsOf(p);
              const hasVariants = variants.length > 0;
              const inCart = Object.entries(qty)
                .filter(([key]) => key === p.id || key.startsWith(`${p.id}:`))
                .reduce((sum, [, q]) => sum + q, 0);
              const soldOut = p.stock <= 0;
              const low = !soldOut && p.stock <= LOW_STOCK;

              return (
                <article
                  key={p.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card transition-shadow hover:shadow-card-hover"
                >
                  <button
                    type="button"
                    onClick={() => openProduct(p)}
                    aria-label={`Ver detalhes de ${p.name}`}
                    className="relative block aspect-square w-full overflow-hidden bg-surface-muted text-gray-neutral/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                  >
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className={cn(
                          "h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]",
                          soldOut && "opacity-60 grayscale",
                        )}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Package className="h-10 w-10" />
                      </span>
                    )}
                    {/* Fundo sólido: o Badge translúcido some em cima da foto. */}
                    {(soldOut || low) && (
                      <span
                        className={cn(
                          "absolute left-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-semibold shadow-card",
                          soldOut ? "text-danger" : "text-[#8a6418]",
                        )}
                      >
                        {soldOut ? "Esgotado" : `Só ${p.stock} em estoque`}
                      </span>
                    )}
                    {inCart > 0 && (
                      <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange px-2 py-0.5 text-xs font-semibold text-white">
                        <ShoppingBag className="h-3 w-3" aria-hidden /> {inCart}
                      </span>
                    )}
                  </button>

                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <button
                      type="button"
                      onClick={() => openProduct(p)}
                      className="text-left focus-visible:outline-none focus-visible:underline"
                    >
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-graphite sm:text-base">
                        {p.name}
                      </p>
                    </button>
                    <p className="mt-0.5 truncate text-xs text-gray-neutral">
                      {[categoryLabel(p.category), hasVariants ? variantAxesLabel(variants) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-2 font-heading text-lg font-bold tabular-nums text-graphite">
                      {hasVariants && (
                        <span className="mr-1 font-sans text-xs font-normal text-gray-neutral">
                          a partir de
                        </span>
                      )}
                      {formatBRL(priceFrom(p))}
                    </p>

                    <div className="mt-auto pt-3">
                      {soldOut ? (
                        <Button type="button" variant="secondary" size="sm" className="w-full" disabled>
                          Esgotado
                        </Button>
                      ) : hasVariants ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          onClick={() => openProduct(p)}
                        >
                          Escolher opções
                        </Button>
                      ) : (qty[p.id] ?? 0) > 0 ? (
                        <QtyStepper
                          value={qty[p.id] ?? 0}
                          max={p.stock}
                          label={p.name}
                          onChange={(delta) => setQ(p.id, delta, p.stock)}
                          className="w-full"
                        />
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="w-full"
                          onClick={() => setQ(p.id, 1, p.stock)}
                        >
                          <Plus className="h-4 w-4" /> Adicionar
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Espaço para a barra da sacola não cobrir o último card no celular. */}
        {itemCount > 0 && <div className="h-16 lg:hidden" aria-hidden />}
      </div>

      <aside className="hidden rounded-2xl border border-graphite/5 bg-surface p-5 shadow-card lg:sticky lg:top-8 lg:block">
        {renderCart(true)}
      </aside>

      {/* Celular: a sacola vive numa barra acima do menu e abre num diálogo. */}
      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[4.25rem] z-20 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="mx-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-graphite px-4 py-3 text-white shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-4 w-4" aria-hidden />
              {itemCount} {itemCount === 1 ? "item" : "itens"} · {formatBRL(total)}
            </span>
            <span className="text-sm font-semibold text-orange">Ver sacola</span>
          </button>
        </div>
      )}

      <Dialog open={cartOpen} onOpenChange={setCartOpen} title="Sua sacola">
        {renderCart(false)}
      </Dialog>

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
                  <QtyStepper
                    value={openedQty}
                    max={openedStock}
                    label={opened.name}
                    onChange={(delta) => setQ(openedCartId, delta, openedStock)}
                    className="w-[7.5rem]"
                  />
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
              <ShoppingBag className="h-4 w-4" /> Adicionar à sacola
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
