import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, EmptyState, Avatar } from "@mylivepet/ui";
import { AppointmentStatusBadge } from "@/components/status-badge";
import type { AppointmentStatus } from "@mylivepet/types";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function AtendimentosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment")
    .select("id, status, origin, scheduled_at, pet(id, name), service_type(name)")
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const rows = data ?? [];

  return (
    <div>
      <PageHeader title="Atendimentos" subtitle="Agenda e andamento dos serviços." />

      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhum atendimento ainda" />
      ) : (
        <>
        {/* Mobile: cards */}
        <div className="space-y-3 md:hidden">
          {rows.map((a) => {
            const pet = a.pet as unknown as { id: string; name: string } | null;
            const service = a.service_type as unknown as { name: string } | null;
            const inner = (
              <Card className="flex items-center gap-3 p-4">
                <Avatar name={pet?.name ?? "Pet"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-graphite">{pet?.name ?? "—"}</p>
                  <p className="truncate text-xs text-gray-neutral">
                    {service?.name ?? "—"} · {formatDate(a.scheduled_at)}
                  </p>
                  <div className="mt-1.5">
                    <AppointmentStatusBadge status={a.status as AppointmentStatus} />
                  </div>
                </div>
              </Card>
            );
            return (
              <Link key={a.id} href={`/atendimentos/${a.id}`} className="block">
                {inner}
              </Link>
            );
          })}
        </div>

        {/* Desktop: tabela */}
        <Card className="hidden overflow-x-auto p-0 md:block">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-gray-neutral">
              <tr>
                <th className="px-5 py-3 font-medium">Pet</th>
                <th className="px-5 py-3 font-medium">Serviço</th>
                <th className="px-5 py-3 font-medium">Quando</th>
                <th className="px-5 py-3 font-medium">Origem</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const pet = a.pet as unknown as { id: string; name: string } | null;
                const service = a.service_type as unknown as { name: string } | null;
                return (
                  <tr key={a.id} className="border-t border-graphite/5 transition-colors hover:bg-surface-muted/60">
                    <td className="px-5 py-3 font-medium text-graphite">
                      <Link href={`/atendimentos/${a.id}`} className="hover:text-orange">
                        {pet?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-neutral">{service?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-neutral">{formatDate(a.scheduled_at)}</td>
                    <td className="px-5 py-3 text-gray-neutral">
                      {a.origin === "TUTOR" ? "Tutor" : "Petshop"}
                    </td>
                    <td className="px-5 py-3">
                      <AppointmentStatusBadge status={a.status as AppointmentStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
      )}
    </div>
  );
}
