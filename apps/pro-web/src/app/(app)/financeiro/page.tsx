import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { Card, PageHeader, StatCard, StatusChip } from "@mylivepet/ui";
import {
  FINANCE_MOVEMENT_KINDS,
  FINANCE_ORIGINS,
  formatBRL,
  PAYMENT_METHODS,
  STOCK_MOVEMENT_SOURCES,
  STOCK_MOVEMENT_TYPES,
  type FinanceMovementDTO,
  type FinanceSearchResult,
  type PaymentMethod,
  type StockMovementDTO,
  type StockMovementSource,
  type StockMovementType,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import { FinanceiroTabs } from "@/components/financeiro-tabs";
import { FinanceEntryDialog } from "@/components/finance-entry-dialog";
import {
  StockMovementDialog,
  type StockProductOption,
} from "@/components/stock-movement-dialog";
import {
  CounterSaleDialog,
  type SaleProductOption,
} from "@/components/counter-sale-dialog";
import {
  FinanceFilters,
  type ManagementFilterValues,
} from "@/components/finance-filters";
import { FinanceMovementList } from "@/components/finance-movement-list";
import { StockMovementList } from "@/components/stock-movement-list";

type SearchParams = {
  tab?: string;
  q?: string;
  from?: string;
  to?: string;
  min?: string;
  max?: string;
  kind?: string;
  origin?: string;
  payment?: string;
  item?: string;
  terminal?: string;
  page?: string;
};

type ProductRow = SaleProductOption & {
  min_stock: number;
  active: boolean;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function localIso(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function validDate(value?: string) {
  if (!value || !isoDatePattern.test(value)) return undefined;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : value;
}

function centsFromQuery(value?: string) {
  if (!value) return undefined;
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : undefined;
}

function oneOf<const T extends readonly string[]>(
  value: string | undefined,
  options: T,
) {
  return value && options.includes(value as T[number])
    ? (value as T[number])
    : undefined;
}

function queryHref(
  current: URLSearchParams,
  patch: Record<string, string | null>,
) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return `/financeiro?${next.toString()}`;
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const activeTab = raw.tab === "estoque" ? "estoque" : "financeiro";
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let from = validDate(raw.from) ?? localIso(monthStart);
  let to = validDate(raw.to) ?? localIso(today);
  if (from > to) [from, to] = [to, from];

  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  const q = (raw.q ?? "").trim().slice(0, 120);
  const minCents = centsFromQuery(raw.min);
  const maxCents = centsFromQuery(raw.max);
  const financeKind = oneOf(raw.kind, FINANCE_MOVEMENT_KINDS);
  const financeOrigin = oneOf(raw.origin, FINANCE_ORIGINS);
  const payment = oneOf(raw.payment, PAYMENT_METHODS);
  const item = raw.item && uuidPattern.test(raw.item) ? raw.item : undefined;
  const terminalFilter =
    raw.terminal && uuidPattern.test(raw.terminal) ? raw.terminal : undefined;
  const stockType = oneOf(raw.kind, STOCK_MOVEMENT_TYPES);
  const stockSource = oneOf(raw.origin, STOCK_MOVEMENT_SOURCES);

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) {
    return (
      <Card className="p-6">
        <p className="text-sm text-danger">
          Nenhum petshop vinculado à sua conta.
        </p>
      </Card>
    );
  }

  const financePromise =
    activeTab === "financeiro"
      ? supabase.rpc("search_finance_movements", {
          p_tenant_id: tenant.tenantId,
          p_q: q || undefined,
          p_from: from,
          p_to: to,
          p_min_cents: minCents,
          p_max_cents: maxCents,
          p_kind: financeKind,
          p_origin: financeOrigin,
          p_payment: payment,
          p_item: item,
          p_terminal: terminalFilter,
          p_page: page,
          p_page_size: 50,
        })
      : Promise.resolve({ data: null, error: null });
  const stockPromise =
    activeTab === "estoque"
      ? supabase.rpc("search_stock_movements", {
          p_tenant_id: tenant.tenantId,
          p_q: q || undefined,
          p_from: from,
          p_to: to,
          p_type: stockType,
          p_source: stockSource,
          p_page: page,
          p_page_size: 50,
        })
      : Promise.resolve({ data: null, error: null });

  const [
    financeResponse,
    stockResponse,
    { data: products },
    { data: tutors },
    { data: services },
    terminals,
  ] = await Promise.all([
    financePromise,
    stockPromise,
    supabase
      .from("product")
      .select(
        `id, name, price_cents, stock, min_stock, active,
         product_variant(id, color_name, size, weight_value, weight_unit, price_cents, stock, active)`,
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("tutor")
      .select("id, full_name, cpf, phone")
      .eq("tenant_id", tenant.tenantId)
      .order("full_name"),
    supabase
      .from("service_type")
      .select("id, name")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    loadPaymentTerminals(supabase, tenant.tenantId),
  ]);

  const productList = (products ?? []) as unknown as ProductRow[];
  const financeData = (financeResponse.data ?? {
    rows: [],
    total: 0,
    income_cents: 0,
    expense_cents: 0,
    balance_cents: 0,
    fee_cents: 0,
    net_income_cents: 0,
    net_balance_cents: 0,
  }) as unknown as FinanceSearchResult;
  const stockData = (stockResponse.data ?? {
    rows: [],
    total: 0,
  }) as unknown as { rows: StockMovementDTO[]; total: number };
  const canManage = tenant.role !== "VIEWER";
  // Sem maquininha cadastrada a taxa é sempre zero — os cards de líquido só
  // poluiriam a leitura de quem ainda não configurou nada.
  const showFees = terminals.length > 0;
  const lowStock = productList.filter(
    (product) => product.min_stock > 0 && product.stock <= product.min_stock,
  );

  const filterValues: ManagementFilterValues = {
    q,
    from,
    to,
    min: raw.min ?? "",
    max: raw.max ?? "",
    kind: activeTab === "financeiro" ? (financeKind ?? "") : (stockType ?? ""),
    origin:
      activeTab === "financeiro" ? (financeOrigin ?? "") : (stockSource ?? ""),
    payment: payment ?? "",
    item: item ?? "",
    terminal: terminalFilter ?? "",
  };

  const currentQuery = new URLSearchParams();
  currentQuery.set("tab", activeTab);
  for (const [key, value] of Object.entries({
    q,
    from,
    to,
    min: raw.min,
    max: raw.max,
    kind: filterValues.kind,
    origin: filterValues.origin,
    payment: filterValues.payment,
    item: filterValues.item,
    terminal: filterValues.terminal,
  })) {
    if (value) currentQuery.set(key, value);
  }

  const total =
    activeTab === "financeiro" ? financeData.total : stockData.total;
  const totalPages = Math.max(1, Math.ceil(total / 50));
  const itemOptions = [
    ...(services ?? []).map((service) => ({
      id: service.id,
      label: service.name,
      group: "Serviços" as const,
    })),
    ...productList.map((product) => ({
      id: product.id,
      label: product.name,
      group: "Produtos" as const,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas, despesas, vendas, devoluções e controle de estoque."
        actions={
          activeTab === "financeiro" ? (
            <div className="flex flex-wrap gap-2">
              <CounterSaleDialog
                products={productList}
                tutors={tutors ?? []}
                terminals={terminals}
                disabled={!canManage}
              />
              <FinanceEntryDialog terminals={terminals} disabled={!canManage} />
            </div>
          ) : (
            <StockMovementDialog
              disabled={!canManage}
              products={productList.map(
                ({ id, name, stock, product_variant }) => ({
                  id,
                  name,
                  stock,
                  product_variant,
                }),
              )}
            />
          )
        }
      />

      <FinanceiroTabs active={activeTab} />

      <FinanceFilters
        tab={activeTab}
        values={filterValues}
        items={itemOptions}
        terminals={terminals}
      />

      {(financeResponse.error || stockResponse.error) && (
        <Card className="mb-6 border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">
            Não foi possível consultar as movimentações. Aplique as migrações
            mais recentes e tente novamente.
          </p>
        </Card>
      )}

      {activeTab === "financeiro" ? (
        <div className="space-y-6">
          <div
            className={
              showFees
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                : "grid grid-cols-1 gap-4 sm:grid-cols-3"
            }
          >
            <Link
              href={queryHref(currentQuery, { kind: "INCOME", page: null })}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            >
              <StatCard
                label="Receitas no filtro"
                value={formatBRL(financeData.income_cents)}
                hint={
                  showFees
                    ? `Líquido: ${formatBRL(financeData.net_income_cents)}`
                    : undefined
                }
                icon={<ArrowUpCircle className="h-5 w-5" />}
                accent="#2E9E5B"
              />
            </Link>

            {showFees && (
              <StatCard
                label="Taxas de maquininha"
                value={formatBRL(financeData.fee_cents)}
                hint="Retido pelas operadoras nas receitas do filtro"
                icon={<CreditCard className="h-5 w-5" />}
                accent="#C94A4A"
              />
            )}

            <Link
              href={queryHref(currentQuery, { kind: "EXPENSE", page: null })}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            >
              <StatCard
                label="Despesas no filtro"
                value={formatBRL(financeData.expense_cents)}
                icon={<ArrowDownCircle className="h-5 w-5" />}
                accent="#C0892D"
              />
            </Link>

            <Link
              href={queryHref(currentQuery, { kind: null, page: null })}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            >
              <StatCard
                label={showFees ? "Saldo líquido no filtro" : "Saldo no filtro"}
                value={formatBRL(
                  showFees
                    ? financeData.net_balance_cents
                    : financeData.balance_cents,
                )}
                hint={
                  showFees
                    ? `Antes das taxas: ${formatBRL(financeData.balance_cents)}`
                    : undefined
                }
                icon={<Wallet className="h-5 w-5" />}
                accent={
                  (showFees
                    ? financeData.net_balance_cents
                    : financeData.balance_cents) >= 0
                    ? "#1D4E5F"
                    : "#C94A4A"
                }
              />
            </Link>
          </div>

          <FinanceMovementList
            movements={financeData.rows as FinanceMovementDTO[]}
            canManage={canManage}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {lowStock.length > 0 && (
            <Card className="border-warning/40 bg-warning/5 p-4">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-5 w-5 text-[#8a6418]" />
                <h2 className="font-heading text-sm font-semibold text-graphite">
                  Estoque baixo ({lowStock.length})
                </h2>
              </div>
              <ul className="mt-3 space-y-2">
                {lowStock.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-graphite">
                      {product.name}
                    </span>
                    <StatusChip tone="warning">
                      {product.stock} un. (mín. {product.min_stock})
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <h2 className="mb-3 font-heading text-lg font-semibold text-graphite">
              Movimentações de estoque
            </h2>
            <StockMovementList movements={stockData.rows} />
          </section>
        </div>
      )}

      {totalPages > 1 && (
        <nav
          aria-label="Paginação"
          className="mt-6 flex items-center justify-between rounded-xl border border-graphite/10 bg-surface p-3"
        >
          {page > 1 ? (
            <Link
              href={queryHref(currentQuery, { page: String(page - 1) })}
              className="inline-flex items-center gap-1 text-sm font-medium text-graphite hover:text-orange"
            >
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-gray-neutral">
            Página {Math.min(page, totalPages)} de {totalPages} · {total}{" "}
            resultado(s)
          </span>
          {page < totalPages ? (
            <Link
              href={queryHref(currentQuery, { page: String(page + 1) })}
              className="inline-flex items-center gap-1 text-sm font-medium text-graphite hover:text-orange"
            >
              Próxima <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
