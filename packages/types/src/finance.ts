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
};

export type FinanceSearchResult = {
  rows: FinanceMovementDTO[];
  total: number;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
};

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
