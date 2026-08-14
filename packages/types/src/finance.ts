import type {
  FinanceMovementKind,
  FinanceOrigin,
  FinanceSource,
  PaymentMethod,
  ReservationStatus,
  StockMovementSource,
  StockMovementType,
} from "./enums";

export type FinanceCustomerSnapshot = {
  id?: string | null;
  name: string;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type FinanceProductItemSnapshot = {
  reservation_item_id: string;
  product_id: string;
  name: string;
  variant_id?: string | null;
  variant?: string | null;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
};

export type FinanceRefundItemDetail = {
  reservation_item_id: string;
  quantity: number;
  unit_price_cents: number;
  product: {
    product_id?: string;
    name?: string;
    variant_id?: string | null;
    variant?: string | null;
  };
};

export type FinanceRefundDetail = {
  id: string;
  kind: "PRODUCT_RETURN" | "SERVICE_REFUND";
  amount_cents: number;
  reason: string;
  payment_method: PaymentMethod;
  created_at: string;
  items: FinanceRefundItemDetail[];
};

export type FinanceSnapshot = {
  kind?: "PRODUCT" | "SERVICE" | "REFUND";
  origin?: "TUTOR" | "STAFF";
  customer?: FinanceCustomerSnapshot;
  pet?: { id?: string | null; name?: string | null };
  service?: { id?: string | null; name?: string | null };
  collaborator?: { id?: string | null; name?: string | null };
  responsible?: { id?: string | null; name?: string | null };
  scheduled_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  items?: FinanceProductItemSnapshot[];
  total_cents?: number;
  original_entry_id?: string;
};

export type FinanceMovementDTO = {
  id: string;
  type: "INCOME" | "EXPENSE";
  source: FinanceSource;
  description: string;
  category: string | null;
  amount_cents: number;
  occurred_on: string;
  payment_method: PaymentMethod | null;
  snapshot: FinanceSnapshot;
  appointment_id: string | null;
  reservation_id: string | null;
  refund_id: string | null;
  created_at: string;
  movement_kind: FinanceMovementKind;
  movement_origin: FinanceOrigin;
  reservation_status: ReservationStatus | null;
  refunds: FinanceRefundDetail[];
  // Maquininha e taxa congeladas no momento da venda (0036). terminal_name é
  // snapshot: continua legível se a maquininha sair do cadastro depois.
  terminal_id: string | null;
  terminal_name: string | null;
  installments: number;
  fee_percent: number | string;
  fee_fixed_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  settlement_date: string | null;
};

export type FinanceSearchResult = {
  rows: FinanceMovementDTO[];
  total: number;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
  /** Total retido pelas maquininhas nas receitas do filtro. */
  fee_cents: number;
  net_income_cents: number;
  net_balance_cents: number;
};

// --- Maquininhas e taxas -------------------------------------------------

export type PaymentFeeRule = {
  payment_method: PaymentMethod;
  installments_from: number;
  installments_to: number;
  /** Percentual retido pela operadora (4.99 = 4,99%). */
  fee_percent: number;
  fee_fixed_cents: number;
  settlement_days: number;
};

export type PaymentTerminalDTO = {
  id: string;
  name: string;
  active: boolean;
  is_default: boolean;
  rules: PaymentFeeRule[];
};

/** Regra que cobre a forma de pagamento e o número de parcelas, se houver. */
export function findFeeRule(
  rules: PaymentFeeRule[],
  method: PaymentMethod,
  installments = 1,
): PaymentFeeRule | null {
  const parcels = Math.max(installments, 1);
  return (
    rules.find(
      (rule) =>
        rule.payment_method === method &&
        parcels >= rule.installments_from &&
        parcels <= rule.installments_to,
    ) ?? null
  );
}

/**
 * Quanto a operadora retém. Espelha resolve_payment_fee (0036), inclusive o
 * teto: a tarifa fixa nunca pode engolir mais do que o valor cobrado.
 */
export function computeFeeCents(
  amountCents: number,
  rule: PaymentFeeRule | null,
): number {
  if (!rule) return 0;
  const amount = Math.max(amountCents, 0);
  const fee =
    Math.round((amount * Number(rule.fee_percent)) / 100) +
    rule.fee_fixed_cents;
  return Math.min(amount, Math.max(fee, 0));
}

export type StockMovementDTO = {
  id: string;
  type: StockMovementType;
  source: StockMovementSource;
  quantity: number;
  stock_before: number;
  stock_after: number;
  note: string | null;
  created_at: string;
  reservation_id: string | null;
  refund_id: string | null;
  related: {
    kind: "SALE" | "CANCELLATION" | "EXPIRATION" | "REFUND";
    reservation_id?: string | null;
    finance_entry_id?: string | null;
    status?: ReservationStatus | null;
    reason?: string | null;
    customer?: FinanceCustomerSnapshot | null;
  } | null;
  product: { name: string } | null;
  variant_label: {
    color_name: string | null;
    size: string | null;
    weight_value: number | string | null;
    weight_unit: string | null;
  } | null;
};
