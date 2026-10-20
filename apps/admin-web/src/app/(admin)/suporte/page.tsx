import Link from "next/link";
import type { Metadata } from "next";
import { EyeOff, MessageSquare } from "lucide-react";
import { z } from "zod";
import { EmptyState, cn } from "@mylivepet/ui";
import { requireAdminPage } from "@/lib/auth";
import { dateTimeBR, relative, until } from "@/lib/format";
import {
  CATEGORY_LABEL,
  getTicket,
  listAssignableAdmins,
  listTickets,
  PRIORITY_LABEL,
  QUEUES,
  queueCounts,
  type QueueKey,
  type TicketListItem,
} from "@/lib/support";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterTabs, Panel, Pill, type PillTone } from "@/components/ui";
import { AttachmentButton, Composer, TicketControls } from "./ticket-client";
import { SupportLive } from "./support-live";
import { ChatScroll } from "@/components/chat-scroll";

export const metadata: Metadata = { title: "Suporte" };

const PRIORITY_TONE: Record<string, PillTone> = { URGENT: "red", HIGH: "amber", NORMAL: "gray", LOW: "gray" };

function slaInfo(t: Pick<TicketListItem, "first_response_at" | "first_response_due_at" | "status">) {
  if (t.first_response_at) return { text: "respondido", tone: "text-[#22603F]" };
  if (t.status === "RESOLVED" || t.status === "CLOSED") return { text: "", tone: "" };
  const late = new Date(t.first_response_due_at).getTime() < Date.now();
  const soon = new Date(t.first_response_due_at).getTime() - Date.now() < 2 * 3600_000;
  return { text: late ? until(t.first_response_due_at) : `responder ${until(t.first_response_due_at)}`, tone: late || soon ? "text-[#B5442F]" : "text-gray-neutral" };
}

export default async function SuportePage({
  searchParams,
}: {
  searchParams: Promise<{ fila?: string; t?: string; origem?: string; petshop?: string }>;
}) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const queue = (Object.keys(QUEUES) as QueueKey[]).find((k) => k === sp.fila) ?? "novos";
  const origin = sp.origem === "TENANT" || sp.origem === "TUTOR" ? sp.origem : undefined;
  const tenant = z.string().uuid().safeParse(sp.petshop).success ? sp.petshop : undefined;

  const [tickets, counts, admins] = await Promise.all([
    listTickets({ queue, adminId: admin.userId, origin, tenant }),
    queueCounts(admin.userId),
    listAssignableAdmins(),
  ]);
  const selectedId = z.string().uuid().safeParse(sp.t).success ? sp.t! : tickets[0]?.id;
  const ticket = selectedId ? await getTicket(selectedId) : null;

  const href = (params: Record<string, string | undefined>) => {
    const s = new URLSearchParams();
    const merged = { fila: queue, origem: origin, petshop: tenant, ...params };
    for (const [k, v] of Object.entries(merged)) if (v) s.set(k, v);
    return `/suporte?${s.toString()}`;
  };

  return (
    <>
      <PageHeader title="Suporte" description="Chamados de petshops e tutores sobre a plataforma." actions={<SupportLive />} />
      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            label="Fila"
            tabs={(Object.keys(QUEUES) as QueueKey[]).map((k) => ({
              href: href({ fila: k, t: undefined }),
              label: QUEUES[k].label,
              count: counts[k],
              active: k === queue,
            }))}
          />
          <span className="mx-1 hidden h-6 w-px bg-graphite/15 sm:block" aria-hidden />
          <FilterTabs
            label="Origem"
            tabs={[
              { key: undefined, label: "Todos" },
              { key: "TENANT", label: "Petshops" },
              { key: "TUTOR", label: "Tutores" },
            ].map((o) => ({ href: href({ origem: o.key, t: undefined }), label: o.label, active: o.key === origin }))}
          />
        </div>

        {tickets.length === 0 && !ticket ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="Nenhum chamado nesta fila"
            description="Chamados chegam do painel do petshop (Ajuda e suporte) e do app do tutor (Ajuda)."
          />
        ) : (
          <div className="flex flex-wrap items-stretch gap-4">
            <nav aria-label="Chamados" className="flex min-w-0 flex-[1_1_300px] flex-col gap-1 self-start rounded-[14px] bg-surface p-2 shadow-card">
              {tickets.map((t) => {
                const active = t.id === ticket?.id;
                const sla = slaInfo(t);
                return (
                  <Link
                    key={t.id}
                    href={href({ t: t.id })}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex flex-col gap-1.5 rounded-xl border px-3.5 py-3 transition-colors",
                      active ? "border-petrol/35 bg-petrol/[0.07]" : "border-transparent hover:bg-surface-muted",
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs text-gray-neutral">
                      <span className="tabular">#{t.number}</span>
                      <Pill tone={t.origin === "TENANT" ? "petrol" : "orange"}>{t.origin === "TENANT" ? "Petshop" : "Tutor"}</Pill>
                      {t.hidden_from_tenant && <EyeOff className="h-3.5 w-3.5 text-[#B5442F]" aria-label="Em sigilo" />}
                      <span className="ml-auto">{relative(t.created_at)}</span>
                    </span>
                    <span className="text-sm font-semibold leading-snug text-graphite">{t.subject}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-gray-neutral">{t.tenant?.name ?? "—"}</span>
                      <Pill tone={PRIORITY_TONE[t.priority]}>{PRIORITY_LABEL[t.priority]}</Pill>
                      {sla.text && <span className={cn("font-semibold", sla.tone)}>{sla.text}</span>}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {ticket && (
              <>
                <section aria-label="Conversa" className="flex min-w-0 flex-[3_1_460px] flex-col rounded-[14px] bg-surface shadow-card">
                  <div className="flex flex-col gap-1.5 border-b border-graphite/[0.08] px-5 py-4">
                    <span className="text-xs text-gray-neutral">
                      #{ticket.number} · {CATEGORY_LABEL[ticket.category] ?? ticket.category} · aberto {relative(ticket.created_at)}
                    </span>
                    <h2 className="font-heading text-[19px] font-extrabold leading-snug">{ticket.subject}</h2>
                    {ticket.hidden_from_tenant && (
                      <span className="mt-1 flex items-center gap-1.5 self-start rounded-lg bg-danger/10 px-2.5 py-1.5 text-xs font-bold text-[#9A3825]">
                        <EyeOff className="h-3.5 w-3.5" aria-hidden /> Em sigilo — o petshop não vê este chamado
                      </span>
                    )}
                  </div>
                  <ChatScroll
                    count={ticket.messages.length}
                    conversationKey={ticket.id}
                    className="h-[min(62vh,620px)] min-h-[280px]"
                  >
                  <ol className="flex flex-col gap-3.5 px-5 py-5">
                    {ticket.messages.map((m) => (
                      <li key={m.id} className="flex flex-col">
                        {m.author_kind === "SYSTEM" ? (
                          <p className="self-center text-center text-xs leading-relaxed text-gray-neutral">{m.body}</p>
                        ) : m.internal ? (
                          <div className="flex flex-col gap-1 rounded-xl border border-dashed border-[#C98A12]/50 bg-[#FBF3E2] px-3.5 py-3">
                            <span className="text-xs font-bold text-[#7A4F00]">
                              Nota interna · só a equipe vê · {m.author_name} · {dateTimeBR(m.created_at)}
                            </span>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                          </div>
                        ) : (
                          <div className={cn("flex max-w-[78%] flex-col gap-1", m.author_kind === "ADMIN" ? "items-end self-end" : "items-start self-start")}>
                            <span className="text-xs text-gray-neutral">
                              <strong className="text-graphite">{m.author_name ?? "—"}</strong> · {dateTimeBR(m.created_at)}
                            </span>
                            <p
                              className={cn(
                                "whitespace-pre-wrap break-words px-3.5 py-3 text-sm leading-relaxed",
                                m.author_kind === "ADMIN"
                                  ? "rounded-[14px_4px_14px_14px] bg-petrol text-white"
                                  : "rounded-[4px_14px_14px_14px] bg-surface-muted",
                              )}
                            >
                              {m.body}
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                    {ticket.attachments.length > 0 && (
                      <li className="flex flex-wrap gap-2">
                        {ticket.attachments.map((a) => (
                          <AttachmentButton key={a.id} id={a.id} name={a.file_name} />
                        ))}
                      </li>
                    )}
                  </ol>
                  </ChatScroll>
                  <Composer
                    ticketId={ticket.id}
                    closed={ticket.status === "CLOSED"}
                    resolved={ticket.status === "RESOLVED"}
                  />
                </section>

                <aside aria-label="Contexto do chamado" className="flex min-w-0 flex-[1_1_260px] flex-col gap-4 self-start">
                  <Panel title="Andamento">
                    <TicketControls
                      ticketId={ticket.id}
                      status={ticket.status}
                      priority={ticket.priority}
                      assigned={ticket.assigned_admin}
                      admins={admins}
                    />
                    {!ticket.first_response_at && ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                      <p className={cn("mt-3 text-[13px] font-semibold", slaInfo(ticket).tone)}>
                        Primeira resposta {until(ticket.first_response_due_at)}
                      </p>
                    )}
                  </Panel>
                  <Panel title="Contexto">
                    <dl className="flex flex-col gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-semibold text-gray-neutral">Quem abriu</dt>
                        <dd>
                          {ticket.opened_by_name ?? "—"} · {ticket.origin === "TENANT" ? "petshop" : "tutor"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold text-gray-neutral">{ticket.category === "PETSHOP_REPORT" ? "Petshop citado" : "Petshop"}</dt>
                        <dd>
                          <Link href={`/petshops/${ticket.tenant_id}`} className="font-semibold text-petrol hover:underline">
                            {ticket.tenant?.name ?? "—"}
                          </Link>
                        </dd>
                      </div>
                      {ticket.subscription && (
                        <div>
                          <dt className="text-xs font-semibold text-gray-neutral">Assinatura</dt>
                          <dd>
                            {ticket.subscription.plan ?? "—"} · {ticket.subscription.status.toLowerCase()}
                          </dd>
                        </div>
                      )}
                      {["CAMERAS", "LIVE_CAMERA"].includes(ticket.category) && (
                        <div>
                          <dt className="text-xs font-semibold text-gray-neutral">Câmeras</dt>
                          <dd>
                            {ticket.cameras} ativa(s) · gateway {ticket.gateway_seen_at ? `visto ${relative(ticket.gateway_seen_at)}` : "não configurado"}
                          </dd>
                        </div>
                      )}
                      {ticket.context.page && (
                        <div>
                          <dt className="text-xs font-semibold text-gray-neutral">Página de origem</dt>
                          <dd className="break-all">{ticket.context.page}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="text-xs font-semibold text-gray-neutral">Chamados anteriores</dt>
                        <dd>{ticket.previous}</dd>
                      </div>
                      {ticket.category === "PRIVACY" && (
                        <p className="rounded-lg bg-warning/20 px-3 py-2 text-[13px] text-[#7A4F00]">
                          Pedido LGPD: confirme a identidade antes de excluir ou exportar dados. Prazo legal de 15 dias.
                        </p>
                      )}
                    </dl>
                  </Panel>
                </aside>
              </>
            )}
          </div>
        )}
      </PageBody>
    </>
  );
}
