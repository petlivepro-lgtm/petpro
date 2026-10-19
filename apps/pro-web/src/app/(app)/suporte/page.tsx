import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@mylivepet/ui";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { NewTicketForm } from "./new-ticket-form";

const STATUS_STYLE: Record<SupportStatus, string> = {
  NEW: "bg-surface-muted text-graphite/80",
  IN_PROGRESS: "bg-petrol/10 text-petrol",
  WAITING_CUSTOMER: "bg-orange/10 text-orange",
  RESOLVED: "bg-success/10 text-success",
  CLOSED: "bg-surface-muted text-gray-neutral",
};

export default async function SuportePage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;
  const canOpen = tenant.role === "OWNER" || tenant.role === "MANAGER";

  // RLS: só os chamados abertos por este petshop (nunca os de tutores).
  const { data } = await supabase
    .from("support_ticket")
    .select("id, number, category, subject, status, updated_at")
    .eq("tenant_id", tenant.tenantId)
    .order("updated_at", { ascending: false })
    .limit(30);
  const tickets = data ?? [];

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
                {tickets.map((t) => (
                  <li key={t.id}>
                    <Link href={`/suporte/${t.id}`} className="flex flex-col gap-1 rounded-xl bg-surface-muted px-3 py-2.5 transition-colors hover:bg-gray-soft">
                      <span className="flex items-center gap-2 text-xs text-gray-neutral">
                        #{t.number}
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[t.status as SupportStatus]}`}>
                          {SUPPORT_STATUS_LABEL[t.status as SupportStatus]}
                        </span>
                        <span className="ml-auto">{SUPPORT_CATEGORY_LABEL[t.category] ?? t.category}</span>
                      </span>
                      <span className="text-sm font-semibold text-graphite">{t.subject}</span>
                    </Link>
                  </li>
                ))}
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
