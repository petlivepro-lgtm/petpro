"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Button, Dialog, Label, Select } from "@mylivepet/ui";
import {
  formatBRL,
  formatVariantLabel,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
} from "@mylivepet/types";
import {
  registerCounterSale,
  type FormState,
} from "@/app/(app)/financeiro/actions";

export type SaleProductOption = {
  id: string;
  name: string;
  price_cents: number;
  stock: number;
  product_variant: {
    id: string;
    color_name: string | null;
    size: string | null;
    weight_value: number | string | null;
    weight_unit: string | null;
    price_cents: number;
    stock: number;
    active: boolean;
  }[];
};

type SaleLine = {
  key: string;
  product_id: string;
  variant_id: string;
  quantity: number;
};

const newLine = (key = crypto.randomUUID()): SaleLine => ({
  key,
  product_id: "",
  variant_id: "",
  quantity: 1,
});

export function CounterSaleDialog({
  products,
  tutors,
  disabled = false,
}: {
  products: SaleProductOption[];
  tutors: {
    id: string;
    full_name: string;
    cpf: string | null;
    phone: string | null;
  }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<SaleLine[]>(() => [newLine("initial")]);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerCounterSale,
    { ok: false },
  );

  const items = lines
    .filter((line) => line.product_id)
    .map((line) => ({
      product_id: line.product_id,
      ...(line.variant_id ? { variant_id: line.variant_id } : {}),
      quantity: line.quantity,
    }));

  const total = lines.reduce((sum, line) => {
    const product = products.find(
      (candidate) => candidate.id === line.product_id,
    );
    const variant = product?.product_variant.find(
      (candidate) => candidate.id === line.variant_id,
    );
    return (
      sum + (variant?.price_cents ?? product?.price_cents ?? 0) * line.quantity
    );
  }, 0);

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    setLines([newLine()]);
    setIdempotencyKey(crypto.randomUUID());
    router.refresh();
  }, [state.ok, router]);

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          setIdempotencyKey(crypto.randomUUID());
          setOpen(true);
        }}
        disabled={disabled}
      >
        <ShoppingCart className="h-4 w-4" /> Nova venda
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Nova venda de balcão"
        description="A baixa de estoque e a receita são registradas juntas."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />

          <div>
            <Label htmlFor="counter-tutor">Cliente</Label>
            <Select id="counter-tutor" name="tutor_id" defaultValue="">
              <option value="">Consumidor final</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.full_name}
                  {tutor.cpf ? ` · CPF ${tutor.cpf}` : ""}
                  {tutor.phone ? ` · ${tutor.phone}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Produtos *</Label>
              <button
                type="button"
                onClick={() => setLines((current) => [...current, newLine()])}
                className="inline-flex items-center gap-1 text-sm font-medium text-orange hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </button>
            </div>

            {lines.map((line, index) => {
              const product = products.find(
                (candidate) => candidate.id === line.product_id,
              );
              const variants = (product?.product_variant ?? []).filter(
                (variant) => variant.active,
              );
              const selectedVariant = variants.find(
                (variant) => variant.id === line.variant_id,
              );
              const available = selectedVariant?.stock ?? product?.stock ?? 0;

              return (
                <div
                  key={line.key}
                  className="grid gap-3 rounded-xl border border-graphite/10 p-3 sm:grid-cols-[1fr_1fr_90px_auto]"
                >
                  <div className={variants.length === 0 ? "sm:col-span-2" : ""}>
                    <Label htmlFor={`sale-product-${line.key}`}>Produto</Label>
                    <Select
                      id={`sale-product-${line.key}`}
                      value={line.product_id}
                      onChange={(event) =>
                        updateLine(line.key, {
                          product_id: event.target.value,
                          variant_id: "",
                        })
                      }
                      required
                    >
                      <option value="">Selecione</option>
                      {products.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {variants.length > 0 && (
                    <div>
                      <Label htmlFor={`sale-variant-${line.key}`}>
                        Variação
                      </Label>
                      <Select
                        id={`sale-variant-${line.key}`}
                        value={line.variant_id}
                        onChange={(event) =>
                          updateLine(line.key, {
                            variant_id: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="">Selecione</option>
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {formatVariantLabel(variant) ?? "Variação"} ·{" "}
                            {variant.stock} un.
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div>
                    <Label htmlFor={`sale-quantity-${line.key}`}>Qtd.</Label>
                    <Select
                      id={`sale-quantity-${line.key}`}
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, {
                          quantity: Number(event.target.value),
                        })
                      }
                      disabled={!line.product_id}
                    >
                      {Array.from(
                        { length: Math.max(available, 1) },
                        (_, amount) => amount + 1,
                      )
                        .slice(0, 99)
                        .map((amount) => (
                          <option key={amount} value={amount}>
                            {amount}
                          </option>
                        ))}
                    </Select>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remover item ${index + 1}`}
                    onClick={() =>
                      setLines((current) =>
                        current.length === 1
                          ? [newLine()]
                          : current.filter(
                              (candidate) => candidate.key !== line.key,
                            ),
                      )
                    }
                    className="self-end rounded-lg p-2 text-gray-neutral hover:bg-danger/10 hover:text-danger"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid items-end gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="counter-payment">Forma de pagamento *</Label>
              <Select
                id="counter-payment"
                name="payment_method"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Selecione
                </option>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {PAYMENT_METHOD_LABEL[method]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="rounded-xl bg-surface-muted px-4 py-3 text-right">
              <p className="text-xs text-gray-neutral">Total da venda</p>
              <p className="font-heading text-xl font-semibold text-graphite">
                {formatBRL(total)}
              </p>
            </div>
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || items.length === 0}>
              {pending ? "Registrando..." : "Registrar venda"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
