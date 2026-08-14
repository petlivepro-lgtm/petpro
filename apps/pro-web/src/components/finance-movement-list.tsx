"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CreditCard,
  Package,
  PawPrint,
  ReceiptText,
  RotateCcw,
  UserRound,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Label,
  Select,
  StatusChip,
  Textarea,
} from "@mylivepet/ui";
import {
  formatBRL,
  formatCpfBR,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  RESERVATION_STATUS_LABEL,
  type FinanceMovementDTO,
  type PaymentMethod,
} from "@mylivepet/types";
import {
  refundProductSale,
  refundService,
  type FormState,
} from "@/app/(app)/financeiro/actions";
import { FinanceEntryDeleteButton } from "@/components/finance-entry-dialog";

function formatDay(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Não informado";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function paymentLabel(method: PaymentMethod | null) {
  return method ? PAYMENT_METHOD_LABEL[method] : "Não informado";
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-neutral">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-graphite">{value || "Não informado"}</dd>
    </div>
  );
}

function ProductRefundForm({
  movement,
  onSuccess,
}: {
  movement: FinanceMovementDTO;
  onSuccess: () => void;
}) {
  const items = movement.snapshot.items ?? [];
  const returnedByItem = useMemo(() => {
    const result = new Map<string, number>();
    for (const refund of movement.refunds) {
      for (const item of refund.items) {
        result.set(
          item.reservation_item_id,
          (result.get(item.reservation_item_id) ?? 0) + item.quantity,
        );
      }
    }
    return result;
  }, [movement.refunds]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    refundProductSale,
    { ok: false },
  );

  const selected = items
    .map((item) => ({
      reservation_item_id: item.reservation_item_id,
      quantity: quantities[item.reservation_item_id] ?? 0,
    }))
    .filter((item) => item.quantity > 0);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-danger/20 p-4"
    >
      <input
        type="hidden"
        name="reservation_id"
        value={movement.reservation_id ?? ""}
      />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="items" value={JSON.stringify(selected)} />

      <div>
        <p className="text-sm font-semibold text-graphite">
          Registrar devolução
        </p>
        <p className="text-xs text-gray-neutral">
          Escolha somente as unidades recebidas. O estoque será reposto
          automaticamente.
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const returned = returnedByItem.get(item.reservation_item_id) ?? 0;
          const available = item.quantity - returned;
          return (
            <div
              key={item.reservation_item_id}
              className="grid items-end gap-2 rounded-lg bg-surface-muted p-3 sm:grid-cols-[1fr_100px]"
            >
              <div>
                <p className="text-sm font-medium text-graphite">
                  {item.name}
                  {item.variant ? ` · ${item.variant}` : ""}
                </p>
                <p className="text-xs text-gray-neutral">
                  Original: {item.quantity} · devolvido: {returned} ·
                  disponível: {available}
                </p>
              </div>
              <div>
                <Label htmlFor={`refund-${item.reservation_item_id}`}>
                  Devolver
                </Label>
                <Input
                  id={`refund-${item.reservation_item_id}`}
                  type="number"
                  min="0"
                  max={available}
                  value={quantities[item.reservation_item_id] ?? 0}
                  disabled={available === 0}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.reservation_item_id]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`refund-payment-${movement.id}`}>
            Meio do reembolso *
          </Label>
          <Select
            id={`refund-payment-${movement.id}`}
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
        <div>
          <Label htmlFor={`refund-reason-${movement.id}`}>Motivo *</Label>
          <Textarea
            id={`refund-reason-${movement.id}`}
            name="reason"
            required
            minLength={3}
            rows={2}
            placeholder="Ex.: produto devolvido sem uso"
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button
          type="submit"
          variant="danger"
          size="sm"
          disabled={pending || selected.length === 0}
        >
          <RotateCcw className="h-4 w-4" />
          {pending ? "Devolvendo..." : "Confirmar devolução"}
        </Button>
      </div>
    </form>
  );
}

function ServiceRefundForm({
  movement,
  onSuccess,
}: {
  movement: FinanceMovementDTO;
  onSuccess: () => void;
}) {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    refundService,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-xl border border-danger/20 p-4"
    >
      <input
        type="hidden"
        name="appointment_id"
        value={movement.appointment_id ?? ""}
      />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <p className="text-sm font-semibold text-graphite">Estornar serviço</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`service-refund-payment-${movement.id}`}>
            Meio do reembolso *
          </Label>
          <Select
            id={`service-refund-payment-${movement.id}`}
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
        <div>
          <Label htmlFor={`service-refund-reason-${movement.id}`}>
            Motivo *
          </Label>
          <Textarea
            id={`service-refund-reason-${movement.id}`}
            name="reason"
            rows={2}
            required
            minLength={3}
            placeholder="Ex.: cobrança cancelada"
          />
        </div>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          <RotateCcw className="h-4 w-4" />
          {pending ? "Estornando..." : "Confirmar estorno"}
        </Button>
      </div>
    </form>
  );
}

function MovementDetail({
  movement,
  canManage,
  onMutation,
}: {
  movement: FinanceMovementDTO;
  canManage: boolean;
  onMutation: () => void;
}) {
  const customer = movement.snapshot.customer;
  const isProduct = movement.snapshot.kind === "PRODUCT";
  const isService = movement.snapshot.kind === "SERVICE";
  const productCanRefund =
    isProduct &&
    !!movement.reservation_id &&
    ["COMPLETED", "PARTIALLY_REFUNDED"].includes(
      movement.reservation_status ?? "",
    );
  const serviceCanRefund =
    isService && !!movement.appointment_id && movement.refunds.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 rounded-xl bg-surface-muted p-4 sm:grid-cols-2">
        <DetailField label="Data" value={formatDay(movement.occurred_on)} />
        <DetailField label="Valor" value={formatBRL(movement.amount_cents)} />
        <DetailField
          label="Pagamento"
          value={`${paymentLabel(movement.payment_method)}${
            movement.installments > 1 ? ` em ${movement.installments}x` : ""
          }`}
        />
        <DetailField
          label="Origem"
          value={
            movement.movement_origin === "SERVICE"
              ? "Serviço"
              : movement.movement_origin === "PRODUCT"
                ? "Produto"
                : "Manual"
          }
        />
      </div>

      {movement.terminal_name && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-graphite">
            <CreditCard className="h-4 w-4 text-orange" /> Maquininha
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Operadora" value={movement.terminal_name} />
            <DetailField
              label="Taxa aplicada"
              value={
                movement.fee_cents > 0
                  ? `${formatBRL(movement.fee_cents)} (${Number(
                      movement.fee_percent,
                    ).toLocaleString("pt-BR")}%${
                      movement.fee_fixed_cents > 0
                        ? ` + ${formatBRL(movement.fee_fixed_cents)}`
                        : ""
                    })`
                  : "Sem taxa"
              }
            />
            <DetailField
              label="Líquido recebido"
              value={formatBRL(movement.net_amount_cents)}
            />
            <DetailField
              label="Previsão de recebimento"
              value={
                movement.settlement_date
                  ? formatDay(movement.settlement_date)
                  : "Não informado"
              }
            />
          </dl>
        </section>
      )}

      {customer && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-graphite">
            <UserRound className="h-4 w-4 text-orange" /> Cliente
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Nome" value={customer.name} />
            <DetailField
              label="CPF"
              value={customer.cpf ? formatCpfBR(customer.cpf) : "Não informado"}
            />
            <DetailField label="Telefone" value={customer.phone} />
            <DetailField label="E-mail" value={customer.email} />
          </dl>
        </section>
      )}

      {isProduct && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-graphite">
            <Package className="h-4 w-4 text-orange" /> Itens vendidos
          </h3>
          <div className="overflow-hidden rounded-xl border border-graphite/10">
            {(movement.snapshot.items ?? []).map((item) => {
              const returned = movement.refunds.reduce(
                (sum, refund) =>
                  sum +
                  refund.items
                    .filter(
                      (refundItem) =>
                        refundItem.reservation_item_id ===
                        item.reservation_item_id,
                    )
                    .reduce(
                      (amount, refundItem) => amount + refundItem.quantity,
                      0,
                    ),
                0,
              );
              return (
                <div
                  key={item.reservation_item_id}
                  className="grid gap-2 border-b border-graphite/5 p-3 last:border-b-0 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="text-sm font-medium text-graphite">
                      {item.name}
                      {item.variant ? ` · ${item.variant}` : ""}
                    </p>
                    <p className="text-xs text-gray-neutral">
                      {item.quantity} un. × {formatBRL(item.unit_price_cents)}
                      {returned > 0 ? ` · ${returned} devolvida(s)` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-graphite">
                    {formatBRL(item.subtotal_cents)}
                  </p>
                </div>
              );
            })}
          </div>
          <dl className="mt-3">
            <DetailField
              label="Responsável pela venda"
              value={movement.snapshot.responsible?.name}
            />
          </dl>
        </section>
      )}

      {isService && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-graphite">
            <PawPrint className="h-4 w-4 text-orange" /> Atendimento
          </h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Pet" value={movement.snapshot.pet?.name} />
            <DetailField
              label="Serviço"
              value={movement.snapshot.service?.name}
            />
            <DetailField
              label="Colaborador"
              value={movement.snapshot.collaborator?.name}
            />
            <DetailField
              label="Agendado para"
              value={formatDateTime(movement.snapshot.scheduled_at)}
            />
            <DetailField
              label="Início"
              value={formatDateTime(movement.snapshot.started_at)}
            />
            <DetailField
              label="Conclusão"
              value={formatDateTime(movement.snapshot.finished_at)}
            />
          </dl>
        </section>
      )}

      {movement.refunds.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-graphite">
            <RotateCcw className="h-4 w-4 text-danger" /> Histórico de estornos
          </h3>
          <div className="space-y-2">
            {movement.refunds.map((refund) => (
              <div
                key={refund.id}
                className="rounded-xl bg-danger/5 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-graphite">
                    {formatDateTime(refund.created_at)}
                  </span>
                  <span className="font-semibold text-danger">
                    − {formatBRL(refund.amount_cents)}
                  </span>
                </div>
                <p className="mt-1 text-gray-neutral">
                  {refund.reason} ·{" "}
                  {PAYMENT_METHOD_LABEL[refund.payment_method]}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {canManage && productCanRefund && (
        <ProductRefundForm movement={movement} onSuccess={onMutation} />
      )}
      {canManage && serviceCanRefund && (
        <ServiceRefundForm movement={movement} onSuccess={onMutation} />
      )}
      {canManage && movement.source === "MANUAL" && (
        <div className="flex justify-end border-t border-graphite/10 pt-4">
          <FinanceEntryDeleteButton
            id={movement.id}
            description={movement.description}
          />
        </div>
      )}
    </div>
  );
}

export function FinanceMovementList({
  movements,
  canManage,
}: {
  movements: FinanceMovementDTO[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<FinanceMovementDTO | null>(null);

  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<ReceiptText className="h-6 w-6" />}
        title="Nenhuma movimentação encontrada"
        description="Ajuste os filtros ou registre uma nova venda ou lançamento."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        {movements.map((movement) => (
          <Card key={movement.id} className="p-0">
            <button
              type="button"
              onClick={() => setSelected(movement)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
              aria-label={`Abrir detalhes de ${movement.description}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-graphite">
                  {movement.description}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-neutral">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDay(movement.occurred_on)}
                  <span>·</span>
                  <CreditCard className="h-3.5 w-3.5" />
                  {paymentLabel(movement.payment_method)}
                  {movement.source !== "MANUAL" && <Badge>Automático</Badge>}
                  {movement.reservation_status && (
                    <StatusChip
                      tone={
                        movement.reservation_status === "REFUNDED"
                          ? "danger"
                          : movement.reservation_status === "PARTIALLY_REFUNDED"
                            ? "warning"
                            : "success"
                      }
                    >
                      {RESERVATION_STATUS_LABEL[movement.reservation_status]}
                    </StatusChip>
                  )}
                </p>
              </div>
              <span className="shrink-0 text-right">
                <span
                  className={
                    movement.type === "INCOME"
                      ? "block text-sm font-semibold text-success"
                      : "block text-sm font-semibold text-danger"
                  }
                >
                  {movement.type === "INCOME" ? "+" : "−"}{" "}
                  {formatBRL(movement.amount_cents)}
                </span>
                {movement.fee_cents > 0 && (
                  <span className="block text-xs text-gray-neutral">
                    líquido {formatBRL(movement.net_amount_cents)}
                  </span>
                )}
              </span>
            </button>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.description ?? "Detalhes da movimentação"}
        description="Resumo auditável da movimentação financeira."
      >
        {selected && (
          <MovementDetail
            movement={selected}
            canManage={canManage}
            onMutation={() => {
              setSelected(null);
              router.refresh();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
