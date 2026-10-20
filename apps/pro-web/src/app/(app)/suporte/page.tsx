import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, EmptyState, PageHeader, SupportStatusChip } from "@mylivepet/ui";
import { SUPPORT_CATEGORY_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { NewTicketForm } from "./new-ticket-form";

export default async function SuportePage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;
  const canOpen = tenant.role === "OWNER" || tenant.role === "MANAGER";

  // RLS: só os chamados abertos por este petshop (nunca os de tutores).
  const [{ data }, { data: unreadIds }] = await Promise.all([
    supabase
      .from("support_ticket")
      .select("id, number, category, subject, status, updated_at")
      .eq("tenant_id", tenant.tenantId)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase.rpc("support_unread_tickets", { p_tenant: tenant.tenantId, p_origin: "TENANT" }),
  ]);
  const tickets = data ?? [];
  const unread = new Set<string>((unreadIds ?? []) as string[]);

  return (
    <>
      <RealtimeRefresh
        channel="suporte-lista"
        watches={[{ table: "support_ticket", filter: `tenant_id=eq.${tenant.tenantId}` }]}
      />
      <PageHeader
        title="Ajuda e suporte"
        subtitle="Fale com a equipe do Pet Live Pro sobre o sistema, as câmeras ou a sua assinatura."
      />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Card className="min-w-0 flex-[3]">
          <h2 className="mb-4 font-heading text-lg font-bold">Abrir chamado</h2>
          {canOpen ? (
            <NewTicketForm />
          ) : (
            <p className="text-sm text-gray-neutral">Só o dono ou o gerente do petshop abre chamados com a plataforma.</p>
          )}
        </Card>
        <div className="flex min-w-0 flex-[2] flex-col gap-4">
          <Card>
            <h2 className="mb-3 font-heading text-base font-bold">Seus chamados</h2>
            {tickets.length ? (
              <ul className="flex flex-col gap-2">
                {tickets.map((t) => {
                  const fresh = unread.has(t.id);
                  return (
                    <li key={t.id}>
                      <Link
                        href={`/suporte/${t.id}`}
                        className={`flex flex-col gap-1.5 rounded-xl px-3 py-2.5 transition-colors ${fresh ? "bg-orange/[0.07] ring-1 ring-orange/25 hover:bg-orange/10" : "bg-surface-muted hover:bg-gray-soft"}`}
                      >
                        <span className="flex items-center gap-2 text-xs text-gray-neutral">
                          <span className="tabular-nums">#{t.number}</span>
                          <SupportStatusChip status={t.status as SupportStatus} className="px-2 py-0.5" />
                          <span className="ml-auto truncate">{SUPPORT_CATEGORY_LABEL[t.category] ?? t.category}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 text-sm font-semibold text-graphite">{t.subject}</span>
                          {fresh && (
                            <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-orange">
                              <span className="h-2 w-2 rounded-full bg-orange" aria-hidden /> Nova resposta
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<LifeBuoy className="h-6 w-6" />} title="Nenhum chamado ainda" className="py-8" />
            )}
          </Card>
          <p className="rounded-2xl bg-petrol/[0.07] px-4 py-3.5 text-[13px] leading-relaxed text-petrol">
            Dúvidas dos seus tutores sobre horários e serviços continuam chegando para você em Solicitações e no
            WhatsApp — o suporte do Pet Live Pro cuida só da plataforma.
          </p>
        </div>
      </div>
    </>
  );
}
