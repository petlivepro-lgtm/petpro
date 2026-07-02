import {
  ArrowDownCircle,
  ArrowUpCircle,
  PackageSearch,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, StatCard, StatusChip } from "@mylivepet/ui";
import {
  FINANCE_CATEGORY_LABEL,
  STOCK_MOVEMENT_TYPE_LABEL,
  type FinanceCategory,
  type StockMovementType,
} from "@mylivepet/types";
import { FinanceiroTabs } from "@/components/financeiro-tabs";
import {
  FinanceEntryDeleteButton,
  FinanceEntryDialog,
} from "@/components/finance-entry-dialog";
import {
  StockMovementDialog,
  type StockProductOption,
} from "@/components/stock-movement-dialog";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function money(cents: number) {
  return brl.format(cents / 100);
}

/** "2026-07-02" -> "02/07/2026" sem depender de fuso. */
function formatDay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function categoryLabel(category: string | null) {
  if (!category) return null;
  return FINANCE_CATEGORY_LABEL[category as FinanceCategory] ?? category;
}

type EntryRow = {
  id: string;
  type: "INCOME" | "EXPENSE";
  source: "MANUAL" | "APPOINTMENT" | "RESERVATION";
  description: string;
  category: string | null;
  amount_cents: number;
  occurred_on: string;
};

type MovementRow = {
  id: string;
  type: StockMovementType;
  quantity: number;
  stock_after: number;
  note: string | null;
  created_at: string;
  product: { name: string } | null;
};

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "estoque" ? "estoque" : "financeiro";
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [{ data: entries }, { data: products }, { data: movements }] = await Promise.all([
    supabase
      .from("finance_entry")
      .select("id, type, source, description, category, amount_cents, occurred_on")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("product")
      .select("id, name, stock, min_stock, active")
      .eq("active", true)
      .order("name"),
    supabase
      .from("stock_movement")
      .select("id, type, quantity, stock_after, note, created_at, product(name)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const list = (entries ?? []) as EntryRow[];
  const monthEntries = list.filter((e) => e.occurred_on >= monthStartIso);
  const income = monthEntries
    .filter((e) => e.type === "INCOME")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const expense = monthEntries
    .filter((e) => e.type === "EXPENSE")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const balance = income - expense;

  const productList = (products ?? []) as (StockProductOption & { min_stock: number })[];
  const lowStock = productList.filter((p) => p.stock <= p.min_stock && p.min_stock > 0);
  const movementList = (movements ?? []) as unknown as MovementRow[];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Receitas, despesas e controle de estoque do petshop."
        actions={
          activeTab === "financeiro" ? (
            <FinanceEntryDialog />
          ) : (
            <StockMovementDialog
              products={productList.map(({ id, name, stock }) => ({ id, name, stock }))}
            />
          )
        }
      />

      <FinanceiroTabs active={activeTab} />

      {activeTab === "financeiro" ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Receitas do mês"
              value={money(income)}
              icon={<ArrowUpCircle className="h-5 w-5" />}
              accent="#2E9E5B"
            />
            <StatCard
              label="Despesas do mês"
              value={money(expense)}
              icon={<ArrowDownCircle className="h-5 w-5" />}
              accent="#C0892D"
            />
            <StatCard
              label="Saldo do mês"
              value={money(balance)}
              icon={<Wallet className="h-5 w-5" />}
              accent={balance >= 0 ? "#1D4E5F" : "#C94A4A"}
            />
          </div>

          {list.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="Nenhum lançamento ainda"
              description="Registre receitas e despesas — atendimentos e reservas concluídos entram automaticamente."
              action={<FinanceEntryDialog />}
            />
          ) : (
            <div className="space-y-3">
              {list.map((e) => (
                <Card key={e.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-graphite">{e.description}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-neutral">
                      {formatDay(e.occurred_on)}
                      {categoryLabel(e.category) && <span>· {categoryLabel(e.category)}</span>}
                      {e.source !== "MANUAL" && <Badge>Automático</Badge>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span
                      className={
                        e.type === "INCOME"
                          ? "text-sm font-semibold text-success"
                          : "text-sm font-semibold text-danger"
                      }
                    >
                      {e.type === "INCOME" ? "+" : "−"} {money(e.amount_cents)}
                    </span>
                    {e.source === "MANUAL" && (
                      <FinanceEntryDeleteButton id={e.id} description={e.description} />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
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
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-graphite">{p.name}</span>
                    <StatusChip tone="warning">
                      {p.stock} un. (mín. {p.min_stock})
                    </StatusChip>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <h2 className="mb-3 font-heading text-lg font-semibold text-graphite">
              Últimas movimentações
            </h2>
            {movementList.length === 0 ? (
              <EmptyState
                icon={<PackageSearch className="h-6 w-6" />}
                title="Nenhuma movimentação registrada"
                description="Entradas e saídas de estoque (manuais e por reservas) aparecem aqui."
              />
            ) : (
              <div className="space-y-3">
                {movementList.map((m) => (
                  <Card key={m.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-graphite">
                        {m.product?.name ?? "Produto"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-neutral">
                        {formatDateTime(m.created_at)} · {m.note ?? "Movimentação automática"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <StatusChip tone={m.type === "IN" ? "success" : "danger"}>
                        {STOCK_MOVEMENT_TYPE_LABEL[m.type]} · {m.quantity} un.
                      </StatusChip>
                      <span className="mt-1 text-xs text-gray-neutral">
                        restou {m.stock_after} un.
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
