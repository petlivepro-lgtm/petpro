import Link from "next/link";
import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { EmptyState } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { getBillingOverview } from "@/lib/data";
import { brl, dateBR, num, pct } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/page-header";
import { Bars, FilterTabs, Kpi, KpiGrid, Panel, Pill, TableBox, Td, Th, type PillTone } from "@/components/ui";

export const metadata: Metadata = { title: "Financeiro" };

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  ACTIVE: { label: "Ativa", tone: "green" },
  TRIALING: { label: "Teste grátis", tone: "petrol" },
  PAST_DUE: { label: "Em atraso", tone: "red" },
  CANCELLED: { label: "Cancelada", tone: "gray" },
};

const METHOD: Record<string, string> = { CARD: "Cartão", PIX: "PIX automático", BOLETO: "Boleto" };
const TABS = ["all", "ACTIVE", "TRIALING", "PAST_DUE", "CANCELLED"] as const;

export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  await requireAdminPage({ minRole: "admin" });
  const { situacao } = await searchParams;
  const tab = TABS.find((t) => t === situacao) ?? "all";
  const b = await getBillingOverview();
  const rows = tab === "all" ? b.rows : b.rows.filter((r) => r.status === tab);
  const counts: Record<string, number> = { all: b.rows.length };
  for (const r of b.rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  if (b.total === 0) {
    return (
      <>
        <PageHeader title="Financeiro" description="Assinaturas dos petshops no Pet Live Pro." />
        <PageBody>
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Nenhuma assinatura registrada ainda"
            description="A cobrança dos petshops ainda não está ligada a um gateway de pagamento. Quando estiver, as assinaturas, faturas e a receita recorrente aparecem aqui automaticamente."
          />
        </PageBody>
      </>
    );
  }

  const ticket = b.active + b.past_due > 0 ? Math.round(b.mrr_cents / (b.active + b.past_due)) : 0;
  const churn = pct(b.cancelled_month, b.active + b.cancelled_month);
  const totalPlanMrr = b.by_plan.reduce((s, p) => s + p.mrr_cents, 0);
  const planColors = ["bg-petrol", "bg-orange", "bg-graphite", "bg-warning"];

  return (
    <>
      <PageHeader title="Financeiro" description="Assinaturas dos petshops no Pet Live Pro." />
      <PageBody>
        <KpiGrid>
          <Kpi label="Receita recorrente (MRR)" value={brl(b.mrr_cents)} tone="up" hint="ativas + em atraso" />
          <Kpi label="Assinaturas ativas" value={num(b.active)} />
          <Kpi label="Em teste grátis" value={num(b.trialing)} hint={`${num(b.trial_ending_7d)} terminam em 7 dias`} />
          <Kpi label="Em atraso" value={num(b.past_due)} tone={b.past_due ? "warn" : "muted"} hint={`${brl(b.past_due_cents)} a receber`} />
          <Kpi label="Cancelamentos no mês" value={num(b.cancelled_month)} tone={b.cancelled_month ? "warn" : "muted"} hint={`churn de ${churn}%`} />
          <Kpi label="Ticket médio" value={brl(ticket)} hint="por petshop/mês" />
        </KpiGrid>

        <div className="flex flex-wrap gap-4">
          <Panel title="Receita recorrente mensal" description="últimos 12 meses" className="flex-[3_1_480px]">
            <Bars
              label="Receita recorrente mensal"
              data={b.mrr_series.map((m) => ({ label: m.month, value: m.mrr_cents }))}
              formatValue={(v) => brl(v, { compact: true }).replace("R$ ", "")}
            />
          </Panel>
          <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
            <Panel title="Por plano">
              {b.by_plan.length ? (
                <div className="flex flex-col gap-3.5">
                  <div className="flex h-3 gap-[3px] overflow-hidden rounded-full" aria-hidden>
                    {b.by_plan.map((p, i) => (
                      <div key={p.plan} className={planColors[i % planColors.length]} style={{ flexGrow: p.mrr_cents || 1 }} />
                    ))}
                  </div>
                  {b.by_plan.map((p, i) => (
                    <div key={p.plan} className="flex items-center gap-2.5 text-sm">
                      <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${planColors[i % planColors.length]}`} />
                      <span className="mr-auto font-semibold">{p.plan}</span>
                      <span className="text-gray-neutral tabular">{num(p.count)} assinaturas</span>
                      <span className="min-w-[92px] text-right font-semibold tabular">{brl(p.mrr_cents)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-neutral">{pct(b.by_plan[0]?.mrr_cents ?? 0, totalPlanMrr)}% da receita vem do plano principal.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-neutral">Sem assinaturas pagas ainda.</p>
              )}
            </Panel>
            <Panel title="Precisa de atenção">
              <div className="flex flex-col gap-2.5">
                {b.failed_recent.length > 0 && (
                  <div className="rounded-xl bg-danger/[0.08] px-3.5 py-3 text-sm">
                    <strong className="block font-semibold">{num(b.failed_recent.length)} cobrança(s) falharam na semana</strong>
                    <span className="text-graphite/80">{b.failed_recent.slice(0, 3).map((f) => f.tenant_name).join(", ")}</span>
                  </div>
                )}
                {b.trial_ending_7d > 0 && (
                  <div className="rounded-xl bg-warning/[0.18] px-3.5 py-3 text-sm">
                    <strong className="block font-semibold">{num(b.trial_ending_7d)} teste(s) grátis terminam em 7 dias</strong>
                    <span className="text-graphite/80">Bom momento para conferir se já fizeram o primeiro atendimento.</span>
                  </div>
                )}
                {b.failed_recent.length === 0 && b.trial_ending_7d === 0 && (
                  <p className="text-sm text-gray-neutral">Nada pendente agora.</p>
                )}
              </div>
            </Panel>
          </div>
        </div>

        <Panel
          title="Assinaturas"
          padded={false}
          actions={
            <FilterTabs
              label="Situação da assinatura"
              tabs={[
                { key: "all", label: "Todas" },
                { key: "ACTIVE", label: "Ativas" },
                { key: "TRIALING", label: "Teste grátis" },
                { key: "PAST_DUE", label: "Em atraso" },
                { key: "CANCELLED", label: "Canceladas" },
              ].map((t) => ({
                href: t.key === "all" ? "/financeiro" : `/financeiro?situacao=${t.key}`,
                label: t.label,
                count: counts[t.key] ?? 0,
                active: t.key === tab,
              }))}
            />
          }
        >
          <TableBox minWidth={980}>
            <thead>
              <tr>
                <Th>Petshop</Th>
                <Th>Plano</Th>
                <Th align="right">Valor</Th>
                <Th>Ciclo</Th>
                <Th>Situação</Th>
                <Th>Próxima cobrança</Th>
                <Th>Pagamento</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status, tone: "gray" as PillTone };
                const next = r.status === "TRIALING" ? `teste até ${dateBR(r.trial_ends_at)}` : dateBR(r.current_period_end);
                const method = r.payment_method
                  ? `${METHOD[r.payment_method] ?? r.payment_method}${r.card_brand ? ` · ${r.card_brand}` : ""}${r.card_last4 ? ` final ${r.card_last4}` : ""}`
                  : "—";
                return (
                  <tr key={r.tenant_id}>
                    <Td>
                      <Link href={`/petshops/${r.tenant_id}`} className="font-semibold text-graphite hover:underline">
                        {r.tenant_name}
                      </Link>
                      <span className="block text-xs text-gray-neutral">cliente desde {dateBR(r.created_at)}</span>
                    </Td>
                    <Td>{r.plan ?? "—"}</Td>
                    <Td align="right">{brl(r.price_cents)}</Td>
                    <Td className="text-gray-neutral">{r.cycle === "YEARLY" ? "Anual" : "Mensal"}</Td>
                    <Td>
                      <Pill tone={s.tone}>{s.label}</Pill>
                    </Td>
                    <Td className={r.status === "PAST_DUE" ? "whitespace-nowrap text-[#B5442F]" : "whitespace-nowrap"}>{next}</Td>
                    <Td className="whitespace-nowrap text-gray-neutral">{method}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableBox>
          <p className="px-4 py-3.5 text-[13px] text-gray-neutral">
            Valores vêm do gateway de pagamento. O admin nunca vê número de cartão — só bandeira e final.
          </p>
        </Panel>
      </PageBody>
    </>
  );
}
