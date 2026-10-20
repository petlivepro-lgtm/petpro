import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { SupportStatusChip } from "@mylivepet/ui";
import { TUTOR_APP_TOPICS, TUTOR_PETSHOP_TOPICS, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { RealtimeRefresh } from "@/components/realtime-refresh";

function TopicList({ items, hrefFor }: { items: { value: string; label: string; hint: string }[]; hrefFor: (v: string) => string }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-graphite/10 bg-surface">
      {items.map((t) => (
        <li key={t.value} className="border-b border-graphite/[0.06] last:border-0">
          <Link href={hrefFor(t.value)} className="flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-muted">
            <span className="flex min-w-0 flex-col">
              <span className="text-[15px] font-medium text-graphite">{t.label}</span>
              <span className="text-xs text-gray-neutral">{t.hint}</span>
            </span>
            <ChevronRight className="ml-auto h-[18px] w-[18px] shrink-0 text-graphite/30" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Triagem: o tutor escolhe o assunto ANTES de escrever. Assunto do petshop vai
 * para o próprio petshop (sem chamado); assunto do app vira chamado para a
 * plataforma; problema grave vira chamado em sigilo.
 */
export default async function AjudaPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  // RLS: só os chamados que este tutor abriu.
  const [{ data: tickets }, { data: unreadIds }] = await Promise.all([
    supabase
      .from("support_ticket")
      .select("id, number, subject, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase.rpc("support_unread_tickets", { p_tenant: ctx.tenantId, p_origin: "TUTOR" }),
  ]);
  const unread = new Set<string>((unreadIds ?? []) as string[]);

  return (
    <div className="space-y-6 lg:max-w-2xl">
      {/* RLS: o Realtime só entrega os chamados que este tutor abriu. */}
      <RealtimeRefresh channel="ajuda-lista" watches={[{ table: "support_ticket" }]} />
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Com o que você precisa de ajuda?</h1>
        <p className="text-sm text-gray-neutral">Escolha o assunto e a gente mostra quem resolve mais rápido.</p>
      </header>

      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-gray-neutral">Com o {ctx.tenantName}</h2>
        <TopicList items={TUTOR_PETSHOP_TOPICS} hrefFor={(v) => `/ajuda/petshop/${v.toLowerCase()}`} />
      </section>

      <section className="space-y-2.5">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-gray-neutral">Com o app Pet Live Pro</h2>
        <TopicList items={TUTOR_APP_TOPICS} hrefFor={(v) => `/ajuda/novo?assunto=${v}`} />
      </section>

      <Link
        href="/ajuda/novo?assunto=PETSHOP_REPORT"
        className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-surface p-4 transition-colors hover:bg-danger/5"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
          <AlertTriangle className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-bold text-graphite">Algo grave aconteceu com seu pet?</span>
          <span className="text-[13px] leading-relaxed text-graphite/75">
            Machucado, maus-tratos ou cobrança indevida. Fale com a plataforma em sigilo — o petshop não vê.
          </span>
        </span>
      </Link>

      {tickets && tickets.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-gray-neutral">Seus chamados</h2>
          <ul className="overflow-hidden rounded-2xl border border-graphite/10 bg-surface">
            {tickets.map((t) => (
              <li key={t.id} className="border-b border-graphite/[0.06] last:border-0">
                <Link href={`/ajuda/${t.id}`} className="flex flex-col gap-1.5 px-4 py-3 transition-colors hover:bg-surface-muted">
                  <span className="flex items-center gap-2 text-xs text-gray-neutral">
                    <span className="tabular-nums">#{t.number}</span>
                    <SupportStatusChip status={t.status as SupportStatus} className="px-2 py-0.5" />
                    {unread.has(t.id) && (
                      <span className="ml-auto flex items-center gap-1.5 font-semibold text-orange">
                        <span className="h-2 w-2 rounded-full bg-orange" aria-hidden /> Nova resposta
                      </span>
                    )}
                  </span>
                  <span className="text-[15px] font-semibold text-graphite">{t.subject}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
