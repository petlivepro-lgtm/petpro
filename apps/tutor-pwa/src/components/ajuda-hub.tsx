import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  Bug,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Crown,
  KeyRound,
  MessageCircle,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Video,
  type LucideIcon,
} from "lucide-react";
import { SupportStatusChip, relativeTime } from "@mylivepet/ui";
import { TUTOR_APP_TOPICS, TUTOR_PETSHOP_TOPICS, type SupportStatus } from "@mylivepet/types";
import { RealtimeRefresh } from "./realtime-refresh";
import { TenantBrand } from "./tenant-brand";

/** Ícone de cada assunto da triagem. Assunto novo sem ícone cai no balão. */
const TOPIC_ICON: Record<string, LucideIcon> = {
  SCHEDULE: CalendarClock,
  CARE: Sparkles,
  PRICES: Receipt,
  PRODUCTS: ShoppingBag,
  DELIVERY: Truck,
  CLUBINHO: Crown,
  ACCESS: KeyRound,
  LIVE_CAMERA: Video,
  NOTIFICATIONS: Bell,
  BUG: Bug,
  PRIVACY: ShieldCheck,
};

/**
 * Dúvidas que o próprio app responde. Só o que o produto faz de verdade hoje
 * — cada resposta aponta para a tela onde a coisa acontece.
 */
const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Como cancelo um agendamento?",
    a: (
      <>
        Em <Link href="/atendimentos" className="font-medium text-petrol hover:underline">Atendimentos</Link>,
        abra o card do horário e toque em “Cancelar agendamento”. Dá para cancelar pelo app até
        o horário marcado, antes de o atendimento começar. O petshop é avisado na hora.
      </>
    ),
  },
  {
    q: "Quando consigo assistir ao vivo?",
    a: (
      <>
        Quando o petshop começa o atendimento numa sala com câmera, a transmissão aparece em{" "}
        <Link href="/ao-vivo" className="font-medium text-petrol hover:underline">Ao vivo</Link>.
        Na primeira vez, o app pede a sua autorização para mostrar as imagens.
      </>
    ),
  },
  {
    q: "As gravações ficam salvas?",
    a: (
      <>
        Ficam em <Link href="/ao-vivo" className="font-medium text-petrol hover:underline">Ao vivo</Link>{" "}
        pelo prazo que o petshop definiu. Cada gravação mostra em quantos dias ela expira.
      </>
    ),
  },
  {
    q: "Por que o preço muda de um pet para outro?",
    a: (
      <>
        Muitos serviços têm preço por porte. Mantenha o porte do seu pet em dia em{" "}
        <Link href="/meus-pets" className="font-medium text-petrol hover:underline">Meus pets</Link>{" "}
        para o valor do agendamento sair certo.
      </>
    ),
  },
  {
    q: "Por quanto tempo vale uma reserva de produtos?",
    a: (
      <>
        48 horas. Você paga na loja, na hora de retirar. Acompanhe o andamento em{" "}
        <Link href="/produtos" className="font-medium text-petrol hover:underline">Produtos</Link>,
        no botão “Minhas reservas”.
      </>
    ),
  },
];

function TopicList({
  items,
  hrefFor,
}: {
  items: { value: string; label: string; hint: string }[];
  hrefFor: (v: string) => string;
}) {
  return (
    <ul className="divide-y divide-graphite/[0.06]">
      {items.map((t) => {
        const Icon = TOPIC_ICON[t.value] ?? MessageCircle;
        return (
          <li key={t.value}>
            <Link
              href={hrefFor(t.value)}
              className="group flex min-h-[60px] items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-petrol/[0.07] text-petrol">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-medium text-graphite">{t.label}</span>
                <span className="text-xs text-gray-neutral">{t.hint}</span>
              </span>
              <ChevronRight
                className="ml-auto h-[18px] w-[18px] shrink-0 text-graphite/30 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export type AjudaTicket = {
  id: string;
  number: number;
  subject: string;
  status: string;
  updated_at: string;
};

/**
 * Central de ajuda do tutor (a tela, sem a busca de dados — ver
 * app/(app)/ajuda/page.tsx).
 */
export function AjudaHub({
  tenantName,
  tenantLogoUrl,
  tickets,
  unread,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  tickets: AjudaTicket[];
  /** Chamados com resposta que o tutor ainda não leu. */
  unread: Set<string>;
}) {
  return (
    <div className="space-y-8">
      {/* RLS: o Realtime só entrega os chamados que este tutor abriu. */}
      <RealtimeRefresh channel="ajuda-lista" watches={[{ table: "support_ticket" }]} />
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">
          Com o que você precisa de ajuda?
        </h1>
        <p className="text-sm text-gray-neutral">
          Escolha o assunto e a gente mostra quem resolve mais rápido.
        </p>
      </header>

      {/* Quem já abriu chamado volta aqui para ver a resposta: vem primeiro. */}
      {tickets.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-graphite">Seus chamados</h2>
            {unread.size > 0 && (
              <span className="text-sm font-medium text-orange">
                {unread.size === 1 ? "1 resposta nova" : `${unread.size} respostas novas`}
              </span>
            )}
          </div>
          <ul className="mt-3 divide-y divide-graphite/[0.06] overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
            {tickets.map((t) => {
              const isUnread = unread.has(t.id);
              return (
                <li key={t.id}>
                  <Link
                    href={`/ajuda/${t.id}`}
                    className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
                  >
                    <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-muted text-gray-neutral">
                      <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
                      {isUnread && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-orange ring-2 ring-surface" aria-hidden />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className={`truncate text-[15px] text-graphite ${isUnread ? "font-semibold" : "font-medium"}`}>
                        {t.subject}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-neutral">
                        <span className="tabular-nums">#{t.number}</span>
                        <SupportStatusChip status={t.status as SupportStatus} className="px-2 py-0.5" />
                        <span>{isUnread ? "Nova resposta · " : "Atualizado "}{relativeTime(t.updated_at)}</span>
                      </span>
                    </span>
                    <ChevronRight
                      className="h-[18px] w-[18px] shrink-0 text-graphite/30 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
          <div className="border-b border-graphite/[0.06] px-5 py-4">
            <TenantBrand name={tenantName} logoUrl={tenantLogoUrl} />
            <p className="mt-2 text-sm text-gray-neutral">
              Horários, atendimento, valores e produtos: quem resolve é o petshop, direto pelo WhatsApp.
            </p>
          </div>
          <TopicList items={TUTOR_PETSHOP_TOPICS} hrefFor={(v) => `/ajuda/petshop/${v.toLowerCase()}`} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
          <div className="border-b border-graphite/[0.06] px-5 py-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/faviconpet.svg" alt="" className="h-9 w-9" />
              <span className="font-heading font-semibold text-graphite">App Pet Live Pro</span>
            </div>
            <p className="mt-2 text-sm text-gray-neutral">
              Acesso, câmera, avisos e erros do app: você abre um chamado e responde por aqui.
            </p>
          </div>
          <TopicList items={TUTOR_APP_TOPICS} hrefFor={(v) => `/ajuda/novo?assunto=${v}`} />
        </section>
      </div>

      <Link
        href="/ajuda/novo?assunto=PETSHOP_REPORT"
        className="group flex items-center gap-4 rounded-2xl border border-danger/25 bg-danger/[0.04] p-5 transition-colors hover:bg-danger/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-heading text-base font-bold text-graphite">
            Algo grave aconteceu com seu pet?
          </span>
          <span className="text-sm leading-relaxed text-graphite/75">
            Machucado, maus-tratos ou cobrança indevida. Fale com a plataforma em sigilo — o petshop não vê.
          </span>
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-danger/60 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </Link>

      <section>
        <h2 className="font-heading text-lg font-semibold text-graphite">Perguntas rápidas</h2>
        <div className="mt-3 divide-y divide-graphite/[0.06] overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-medium text-graphite transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  className="h-[18px] w-[18px] shrink-0 text-gray-neutral transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-gray-neutral">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
