import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { getOverview } from "@/lib/data";
import { brl, num, pct, relative } from "@/lib/format";
import { hasRole } from "@/lib/roles";
import { PageBody, PageHeader } from "@/components/page-header";
import { Bars, FilterTabs, Kpi, KpiGrid, Meter, Panel, Pill, TableBox, Td, Th } from "@/components/ui";
import { ActivityList } from "@/components/activity-list";

export const metadata: Metadata = { title: "Visão geral" };

const PERIODS = [
  { days: 1, label: "Hoje" },
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ dias?: string }> }) {
  const admin = await requireAdminPage();
  const { dias } = await searchParams;
  const days = PERIODS.find((p) => String(p.days) === dias)?.days ?? 30;
  const o = await getOverview(days);

  const growth = o.appointments_prev ? Math.round(((o.appointments - o.appointments_prev) / o.appointments_prev) * 100) : null;
  const f = o.funnel;
  const funnel = [
    { label: "Cadastrou o petshop", count: f.signed_up },
    { label: "Criou serviços", count: f.with_service },
    { label: "Primeiro atendimento", count: f.with_appointment },
    { label: "Primeiro tutor no app", count: f.with_app_tutor },
  ];
  const drops = funnel.slice(1).map((step, i) => ({ step: step.label, lost: funnel[i]!.count - step.count }));
  const worst = drops.reduce((a, b) => (b.lost > a.lost ? b : a), drops[0]!);

  return (
    <>
      <PageHeader title="Visão geral" description="A plataforma inteira, todos os petshops e tutores." />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            label="Período"
            tabs={PERIODS.map((p) => ({ href: `/?dias=${p.days}`, label: p.label, active: p.days === days }))}
          />
          <span className="text-[13px] text-gray-neutral">Leitura direta do banco, no momento em que a página abriu.</span>
        </div>

        <KpiGrid>
          <Kpi
            label="Petshops ativos"
            value={num(o.tenants_active)}
            hint={`de ${num(o.tenants_total)} · ${num(o.tenants_new)} novos no período`}
          />
          {hasRole(admin.role, "admin") && (
            <Kpi label="Receita recorrente (MRR)" value={brl(o.mrr_cents, { compact: true })} hint="assinaturas ativas" />
          )}
          <Kpi
            label="Tutores"
            value={num(o.tutors_total)}
            hint={`${num(o.tutors_app)} com conta no app · +${num(o.tutors_new)}`}
            tone="up"
          />
          <Kpi
            label="Atendimentos"
            value={num(o.appointments)}
            hint={growth === null ? "no período" : `${growth >= 0 ? "+" : ""}${growth}% vs. período anterior`}
            tone={growth !== null && growth < 0 ? "warn" : "up"}
          />
          <Kpi label="Valor registrado" value={brl(o.income_cents, { compact: true })} hint="receitas lançadas pelos petshops" />
          <Kpi
            label="Gateways online"
            value={`${num(o.gateways_online)} / ${num(o.gateways_total)}`}
            hint={`${num(o.cameras_total)} câmeras · ${num(o.live_now)} ao vivo agora`}
            tone={o.gateways_online < o.gateways_total ? "warn" : "muted"}
          />
        </KpiGrid>

        <div className="flex flex-wrap gap-4">
          <Panel title="Novos petshops por semana" description="últimas 12 semanas" className="flex-[3_1_420px]">
            <Bars label="Novos petshops por semana" data={o.weekly_signups.map((w) => ({ label: w.week, value: w.count }))} />
          </Panel>
          <Panel title="Funil de ativação" description="Petshops cadastrados nos últimos 90 dias" className="flex-[2_1_320px]">
            <div className="flex flex-col gap-4">
              {funnel.map((step) => (
                <div key={step.label} className="flex flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="font-medium">{step.label}</span>
                    <span className="text-gray-neutral tabular">
                      <strong className="text-graphite">{num(step.count)}</strong> · {pct(step.count, f.signed_up)}%
                    </span>
                  </div>
                  <Meter value={step.count} max={f.signed_up} />
                </div>
              ))}
              {f.signed_up > 0 && worst.lost > 0 && (
                <p className="text-[13px] leading-relaxed text-gray-neutral">
                  Maior perda: antes de “{worst.step.toLowerCase()}” ({num(worst.lost)} petshops).
                </p>
              )}
            </div>
          </Panel>
        </div>

        <div className="flex flex-wrap gap-4">
          <Panel
            title="Petshops parados há 14+ dias"
            className="flex-[3_1_460px]"
            padded={false}
            actions={
              <div className="flex items-center gap-3">
                {o.stalled_total > 0 && <Pill tone="amber">{num(o.stalled_total)} em risco</Pill>}
                <Link href="/petshops?filtro=stalled" className="text-sm font-semibold text-petrol hover:underline">
                  Ver todos
                </Link>
              </div>
            }
          >
            {o.stalled.length ? (
              <TableBox minWidth={520}>
                <thead>
                  <tr>
                    <Th>Petshop</Th>
                    <Th>Último sinal</Th>
                    <Th align="right">Atend. 30d</Th>
                  </tr>
                </thead>
                <tbody>
                  {o.stalled.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <Link href={`/petshops/${s.id}`} className="font-semibold text-graphite hover:underline">
                          {s.name}
                        </Link>
                        {s.address && <span className="block text-xs text-gray-neutral">{s.address}</span>}
                      </Td>
                      <Td>{relative(s.last_activity)}</Td>
                      <Td align="right">{num(s.appointments_30d)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableBox>
            ) : (
              <p className="px-5 pb-6 text-sm text-gray-neutral">Nenhum petshop parado. Todos tiveram atividade nas últimas duas semanas.</p>
            )}
          </Panel>

          <Panel
            title="Atividade agora"
            className="flex-[2_1_320px]"
            actions={
              <Link href="/atividade" className="text-sm font-semibold text-petrol hover:underline">
                Ver tudo
              </Link>
            }
          >
            <ActivityList events={o.feed} />
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
