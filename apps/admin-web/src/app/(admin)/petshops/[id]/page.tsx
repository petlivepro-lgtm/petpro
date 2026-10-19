import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft, KeyRound } from "lucide-react";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { getTenantDetail, getTenantNotes } from "@/lib/data";
import { brl, dateBR, dateTimeBR, num, relative } from "@/lib/format";
import { hasRole } from "@/lib/roles";
import { PageBody, PageHeader } from "@/components/page-header";
import { Kpi, KpiGrid, Meter, Panel, Pill, TableBox, Td, Th } from "@/components/ui";
import { ActivityList } from "@/components/activity-list";
import { ReasonDialog } from "@/components/reason-dialog";
import { NoteForm } from "./note-form";
import { sendOwnerResetLink } from "./actions";

export const metadata: Metadata = { title: "Petshop" };

const ROLE: Record<string, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  ATTENDANT: "Atendente",
  VIEWER: "Leitura",
  COLLABORATOR: "Colaborador",
  DELIVERY: "Entregador",
};

const SUBSCRIPTION: Record<string, { label: string; tone: "green" | "petrol" | "red" | "gray" }> = {
  ACTIVE: { label: "Ativa", tone: "green" },
  TRIALING: { label: "Teste grátis", tone: "petrol" },
  PAST_DUE: { label: "Em atraso", tone: "red" },
  CANCELLED: { label: "Cancelada", tone: "gray" },
};

export default async function PetshopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [d, notes] = await Promise.all([getTenantDetail(id), getTenantNotes(id)]);
  if (!d) notFound();

  const stalled = Date.now() - new Date(d.last_activity).getTime() > 14 * 86400_000;
  const gatewayOnline = d.gateway?.last_seen_at && Date.now() - new Date(d.gateway.last_seen_at).getTime() < 3 * 60_000;
  const m = d.modules;
  const modules = [
    { name: "Agenda", value: m.appointments_30d, detail: `${num(m.appointments_30d)} atendimentos em 30 dias` },
    { name: "Câmera ao vivo", value: m.camera_sessions_30d, detail: `${num(m.camera_sessions_30d)} sessões em 30 dias` },
    { name: "Clubinho", value: m.clubinho_active, detail: `${num(m.clubinho_active)} assinaturas ativas` },
    { name: "Leva-e-traz", value: m.delivery_routes_30d, detail: `${num(m.delivery_routes_30d)} rotas em 30 dias` },
    { name: "Loja e reservas", value: m.reservations_30d, detail: `${num(m.reservations_30d)} reservas em 30 dias` },
    { name: "Boletim do pet", value: m.behavior_reports_30d, detail: `${num(m.behavior_reports_30d)} boletins em 30 dias` },
  ];
  const maxModule = Math.max(1, ...modules.map((x) => x.value));
  const sub = d.subscription ? SUBSCRIPTION[d.subscription.status] : null;

  return (
    <>
      <PageHeader
        back={
          <Link href="/petshops" className="flex min-h-8 items-center gap-1 self-start text-[13px] font-semibold text-petrol hover:underline">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Petshops
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {d.tenant.name}
            <Pill tone={stalled ? "amber" : "green"}>{stalled ? "Parado 14+ dias" : "Ativo"}</Pill>
          </span>
        }
        description={[
          d.tenant.address,
          `cliente desde ${dateBR(d.tenant.created_at)}`,
          d.owner?.name ? `dono: ${d.owner.name}${d.owner.email ? ` (${d.owner.email})` : ""}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          hasRole(admin.role, "admin") && d.owner?.email ? (
            <ReasonDialog
              trigger={
                <>
                  <KeyRound className="h-4 w-4" aria-hidden /> Reenviar link de senha ao dono
                </>
              }
              triggerClassName="inline-flex h-11 items-center gap-2 rounded-xl border border-graphite/15 bg-surface px-4 text-sm font-semibold text-graphite transition-colors hover:bg-surface-muted"
              title="Reenviar link de senha ao dono"
              description="O dono recebe um e-mail para criar uma senha nova no painel. Você não vê nem define a senha."
              confirmLabel="Enviar link"
              action={sendOwnerResetLink.bind(null, d.tenant.id)}
            />
          ) : null
        }
      />
      <PageBody>
        <KpiGrid>
          <Kpi label="Tutores" value={num(d.kpis.tutors)} hint={`${num(d.kpis.tutors_app)} com conta no app`} />
          <Kpi label="Pets" value={num(d.kpis.pets)} />
          <Kpi label="Atendimentos 30d" value={num(d.kpis.appointments_30d)} />
          <Kpi label="Valor registrado 30d" value={brl(d.kpis.income_30d_cents, { compact: true })} />
          <Kpi label="Clubinho ativos" value={num(d.kpis.clubinho_active)} />
          <Kpi label="Serviços ativos" value={num(d.kpis.services)} />
        </KpiGrid>

        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-[3_1_440px] flex-col gap-4">
            <Panel title="Uso por módulo">
              <div className="flex flex-col gap-3.5">
                {modules.map((x) => (
                  <div key={x.name} className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    <span className="w-[150px] text-sm font-semibold">{x.name}</span>
                    <div className="min-w-[140px] flex-1">
                      <Meter value={x.value} max={maxModule} tone={x.value === 0 ? "amber" : "petrol"} />
                    </div>
                    <span className="w-[200px] text-right text-[13px] text-gray-neutral">{x.detail}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Equipe" padded={false}>
              <TableBox minWidth={480}>
                <thead>
                  <tr>
                    <Th>Pessoa</Th>
                    <Th>Papel</Th>
                    <Th>Último acesso</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.team.map((t, i) => (
                    <tr key={`${t.email}-${i}`}>
                      <Td>
                        <span className="block font-semibold">{t.name ?? "—"}</span>
                        <span className="block text-xs text-gray-neutral">{t.email ?? ""}</span>
                      </Td>
                      <Td>{ROLE[t.role] ?? t.role}</Td>
                      <Td className="text-gray-neutral">{relative(t.last_sign_in_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableBox>
            </Panel>

            <Panel
              title="Câmeras e gateway"
              actions={
                d.gateway ? (
                  <span className={`flex items-center gap-1.5 text-[13px] font-semibold ${gatewayOnline ? "text-[#22603F]" : "text-[#B5442F]"}`}>
                    <span aria-hidden className={`h-2 w-2 rounded-full ${gatewayOnline ? "bg-success" : "bg-[#B5442F]"}`} />
                    Gateway {gatewayOnline ? "online" : "offline"} · visto {relative(d.gateway.last_seen_at)}
                  </span>
                ) : (
                  <Pill>Sem gateway</Pill>
                )
              }
            >
              {d.cameras.length ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
                  {d.cameras.map((c) => (
                    <div key={c.id} className="flex flex-col gap-1 rounded-xl border border-graphite/10 p-3.5">
                      <span className="text-sm font-semibold">{c.room_label}</span>
                      <span className={`text-[13px] ${c.live ? "font-semibold text-[#22603F]" : "text-gray-neutral"}`}>
                        {!c.active ? "Desativada" : c.live ? "Ao vivo agora" : "Sem transmissão"}
                      </span>
                      <span className="text-xs text-gray-neutral">
                        Última sessão: {c.last_session_at ? relative(c.last_session_at) : "nunca"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-neutral">Nenhuma câmera cadastrada.</p>
              )}
              <p className="mt-3 text-[13px] text-gray-neutral">
                Só status e metadados. O admin não assiste vídeo ao vivo nem gravações.
              </p>
            </Panel>
          </div>

          <div className="flex min-w-0 flex-[2_1_320px] flex-col gap-4">
            {hasRole(admin.role, "admin") && (
              <Panel title="Assinatura">
                {d.subscription && sub ? (
                  <div className="flex flex-col gap-1.5 text-sm">
                    <span className="flex items-center gap-2">
                      <strong className="font-semibold">{d.subscription.plan ?? "Sem plano"}</strong>
                      <Pill tone={sub.tone}>{sub.label}</Pill>
                    </span>
                    <span className="text-gray-neutral">
                      {brl(d.subscription.price_cents)} / {d.subscription.cycle === "YEARLY" ? "ano" : "mês"}
                    </span>
                    {d.subscription.current_period_end && (
                      <span className="text-gray-neutral">Próxima cobrança: {dateBR(d.subscription.current_period_end)}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-neutral">Sem assinatura registrada. A cobrança dos petshops ainda não está ligada a um gateway.</p>
                )}
              </Panel>
            )}

            <Panel
              title="Notas internas"
              actions={
                d.support_open > 0 ? (
                  <Link href={`/suporte?petshop=${d.tenant.id}`} className="text-sm font-semibold text-petrol hover:underline">
                    {num(d.support_open)} chamado(s) aberto(s)
                  </Link>
                ) : null
              }
            >
              <div className="flex flex-col gap-3">
                {notes.map((n) => (
                  <div key={n.id} className="flex flex-col gap-1.5 rounded-xl bg-[#FBF6EE] px-3.5 py-3">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</p>
                    <span className="text-xs text-gray-neutral">
                      {n.author_name ?? "—"} · {dateTimeBR(n.created_at)}
                    </span>
                  </div>
                ))}
                <NoteForm tenantId={d.tenant.id} />
              </div>
            </Panel>

            <Panel title="Linha do tempo">
              <ActivityList events={d.timeline} showTenant={false} />
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
