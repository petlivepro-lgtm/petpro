import Link from "next/link";
import { Users, PawPrint, Package, CalendarClock, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, Card, EmptyState } from "@mylivepet/ui";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { RecentSolicitacoes } from "@/components/recent-solicitacoes";
import { mapRecent } from "@/lib/solicitacoes";
import type { AppointmentStatus } from "@mylivepet/types";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const countOf = async (table: "tutor" | "pet" | "product") =>
    (await supabase.from(table).select("*", { count: "exact", head: true })).count ?? 0;

  const [
    tutores,
    pets,
    produtos,
    { data: solicitacoes },
    { data: proximos },
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
  ]);

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
