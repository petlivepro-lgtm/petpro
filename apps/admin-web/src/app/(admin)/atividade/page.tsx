import Link from "next/link";
import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { getActivityFeed } from "@/lib/data";
import { PageBody, PageHeader } from "@/components/page-header";
import { FilterTabs, Panel } from "@/components/ui";
import { ActivityList } from "@/components/activity-list";

export const metadata: Metadata = { title: "Atividade" };

const KINDS = [
  { key: undefined, label: "Tudo" },
  { key: "TENANT_SIGNUP", label: "Cadastros" },
  { key: "APPOINTMENT_COMPLETED", label: "Atendimentos concluídos" },
  { key: "APPOINTMENT_REQUESTED", label: "Pedidos pelo app" },
  { key: "APPOINTMENT_CANCELLED", label: "Cancelamentos" },
  { key: "RESERVATION", label: "Reservas" },
  { key: "DELIVERY", label: "Leva-e-traz" },
  { key: "CLUBINHO", label: "Clubinho" },
  { key: "SUPPORT", label: "Suporte" },
] as const;

const LIMIT = 50;

export default async function AtividadePage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; antes?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const kind = KINDS.find((k) => k.key === sp.tipo)?.key;
  const before = sp.antes && !Number.isNaN(Date.parse(sp.antes)) ? sp.antes : undefined;
  const events = await getActivityFeed({ limit: LIMIT, kind, before });
  const last = events.at(-1);

  return (
    <>
      <PageHeader title="Atividade" description="O que está acontecendo nos petshops, do mais recente para o mais antigo." />
      <PageBody>
        <FilterTabs
          label="Tipo de evento"
          tabs={KINDS.map((k) => ({ href: k.key ? `/atividade?tipo=${k.key}` : "/atividade", label: k.label, active: k.key === kind }))}
        />
        <Panel>
          <ActivityList events={events} />
          {events.length === LIMIT && last && (
            <Link
              href={`/atividade?${new URLSearchParams({ ...(kind ? { tipo: kind } : {}), antes: last.at }).toString()}`}
              className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-graphite/15 px-4 text-sm font-semibold text-graphite hover:bg-surface-muted"
            >
              Carregar mais antigos
            </Link>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
