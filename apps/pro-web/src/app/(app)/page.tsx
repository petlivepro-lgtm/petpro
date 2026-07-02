import Link from "next/link";
import { Users, PawPrint, Package, CalendarClock, ArrowRight, Wallet, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Card, EmptyState } from "@mylivepet/ui";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { RecentSolicitacoes } from "@/components/recent-solicitacoes";
import { FinanceBarChart, type FinanceChartPoint } from "@/components/charts/finance-bar-chart";
import { StockBarChart, type StockChartPoint } from "@/components/charts/stock-bar-chart";
import { mapRecent } from "@/lib/solicitacoes";
import type { AppointmentStatus } from "@mylivepet/types";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Últimos 6 meses (YYYY-MM + rótulo pt-BR), do mais antigo ao atual. */
function lastSixMonths(): { key: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
    };
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const countOf = async (table: "tutor" | "pet" | "product") =>
    (await supabase.from(table).select("*", { count: "exact", head: true })).count ?? 0;

  const months = lastSixMonths();
  const financeSince = `${months[0].key}-01`;

  const [
    tutores,
    pets,
    produtos,
    { data: solicitacoes },
    { data: proximos },
    { data: financeEntries },
    { data: stockProducts },
  ] = await Promise.all([
    countOf("tutor"),
    countOf("pet"),
    countOf("product"),
    supabase
      .from("appointment")
      .select("id, scheduled_at, status, pet(id, name), service_type(name), tutor(full_name)")
      .eq("status", "REQUESTED")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase
      .from("appointment")
      .select("id, scheduled_at, status, pet(id, name), service_type(name)")
      .in("status", ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS"])
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("finance_entry")
      .select("type, amount_cents, occurred_on")
      .gte("occurred_on", financeSince),
    supabase
      .from("product")
      .select("name, stock, min_stock")
      .eq("active", true)
      .order("stock", { ascending: true })
      .limit(30),
  ]);

  // Receitas x despesas por mês (em reais), preenchendo meses sem lançamentos.
  const byMonth = new Map(months.map((m) => [m.key, { income: 0, expense: 0 }]));
  for (const e of financeEntries ?? []) {
    const bucket = byMonth.get(e.occurred_on.slice(0, 7));
    if (!bucket) continue;
    if (e.type === "INCOME") bucket.income += e.amount_cents;
    else bucket.expense += e.amount_cents;
  }
  const financeData: FinanceChartPoint[] = months.map((m) => ({
    month: m.label,
    income: (byMonth.get(m.key)?.income ?? 0) / 100,
    expense: (byMonth.get(m.key)?.expense ?? 0) / 100,
  }));
  const hasFinanceData = (financeEntries ?? []).length > 0;

  // Itens mais críticos: menor folga (estoque - mínimo) primeiro.
  const stockData: StockChartPoint[] = (stockProducts ?? [])
    .map((p) => ({ name: p.name, stock: p.stock, min: p.min_stock }))
    .sort((a, b) => a.stock - a.min - (b.stock - b.min))
    .slice(0, 8);

  const cards = [
    { label: "Tutores", value: tutores, hint: "cadastrados", icon: <Users className="h-5 w-5" />, accent: "#1D4E5F" },
    { label: "Pets", value: pets, hint: "ativos", icon: <PawPrint className="h-5 w-5" />, accent: "#2E9E5B" },
    { label: "Produtos", value: produtos, hint: "no catálogo", icon: <Package className="h-5 w-5" />, accent: "#C0892D" },
    { label: "Solicitações", value: solicitacoes?.length ?? 0, hint: "aguardando", icon: <CalendarClock className="h-5 w-5" />, accent: "#FF6A00" },
  ];

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle="Cuidado acompanhado com clareza, segurança e responsabilidade."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-graphite">Receitas × Despesas</h2>
            <Link href="/financeiro" className="inline-flex items-center gap-1 text-sm font-medium text-orange">
              Ver detalhes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="p-4">
            {hasFinanceData ? (
              <FinanceBarChart data={financeData} />
            ) : (
              <EmptyState
                icon={<Wallet className="h-6 w-6" />}
                title="Sem lançamentos ainda"
                description="Registre receitas e despesas na página Financeiro."
              />
            )}
          </Card>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-graphite">Estoque: itens críticos</h2>
            <Link href="/financeiro?tab=estoque" className="inline-flex items-center gap-1 text-sm font-medium text-orange">
              Ver detalhes <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <Card className="p-4">
            {stockData.length > 0 ? (
              <StockBarChart data={stockData} />
            ) : (
              <EmptyState
                icon={<PackageSearch className="h-6 w-6" />}
                title="Sem produtos ativos"
                description="Cadastre produtos para acompanhar o estoque."
              />
            )}
          </Card>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-graphite">Solicitações recentes</h2>
            <Link href="/solicitacoes" className="inline-flex items-center gap-1 text-sm font-medium text-orange">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <RecentSolicitacoes initial={mapRecent((solicitacoes ?? []) as never)} />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-graphite">Próximos atendimentos</h2>
            <Link href="/atendimentos" className="inline-flex items-center gap-1 text-sm font-medium text-orange">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {(proximos ?? []).map((a) => {
              const pet = a.pet as unknown as { id: string; name: string } | null;
              const service = a.service_type as unknown as { name: string } | null;
              return (
                <Card key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-graphite">
                      {pet?.name ?? "Pet"} · {service?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-gray-neutral">{formatDate(a.scheduled_at)}</p>
                  </div>
                  <AppointmentStatusBadge status={a.status as AppointmentStatus} />
                </Card>
              );
            })}
            {(proximos ?? []).length === 0 && (
              <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Sem atendimentos agendados" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
