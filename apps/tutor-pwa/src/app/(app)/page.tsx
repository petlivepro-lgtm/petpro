import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Card, Badge } from "@mylivepet/ui";
import { type AppointmentStatus } from "@mylivepet/types";
import { TUTOR_APPOINTMENT_STATUS_LABEL } from "@/lib/status-labels";
import { REJECTION_NOTICE_SELECT, rejectedSince } from "@/lib/produtos";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import { PetsRow } from "@/components/pets-row";
import { RejectionNotices, type RejectionNotice } from "@/components/rejection-notice";
import { ClubinhoCard } from "@/components/clubinho-card";
import {
  loadMyClubinho,
  loadMyClubinhoSchedules,
  syncClubinhoPeriods,
} from "@/lib/clubinho";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const tone: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string }>;
}) {
  const { pet: petParam } = await searchParams;
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: pets } = await supabase
    .from("pet")
    .select("id, name, species, breed, photo_path")
    .eq("tutor_id", ctx.tutorId)
    .order("name");

  // Reservas recusadas pelo petshop nos últimos dias e ainda não dispensadas:
  // viram aviso no topo da home.
  const { data: rejections } = await supabase
    .from("product_reservation")
    .select(REJECTION_NOTICE_SELECT)
    .eq("tutor_id", ctx.tutorId)
    .eq("status", "REJECTED")
    .gte("rejected_at", rejectedSince())
    .is("rejection_seen_at", null)
    .order("rejected_at", { ascending: false });

  // Clubinho dos pets. A renovação roda antes da leitura porque esta é a tela
  // onde o tutor confere o saldo — sem isso ele veria o ciclo vencido até
  // alguém do petshop abrir o painel.
  await syncClubinhoPeriods(supabase, ctx.tenantId);
  const clubinho = await loadMyClubinho(supabase, ctx.tutorId);
  const clubinhoSchedules = await loadMyClubinhoSchedules(
    supabase,
    clubinho.map((s) => s.id),
  );

  // Média do boletim para o card de cada pet; o boletim completo vive na ficha.
  const summaries = await fetchBehaviorSummaries(
    supabase,
    (pets ?? []).map((p) => p.id),
  );
  const petRows = (pets ?? []).map((p) => ({
    ...p,
    summary: summaries.get(p.id) ?? null,
  }));

  // Pet do histórico: o da querystring (validado contra os pets do tutor) ou o primeiro.
  const selected = (pets ?? []).find((p) => p.id === petParam) ?? pets?.[0] ?? null;

  const appointments = selected
    ? (
        await supabase
          .from("appointment")
          .select("id, status, scheduled_at, service_type(name)")
          .eq("tutor_id", ctx.tutorId)
          .eq("pet_id", selected.id)
          .order("scheduled_at", { ascending: false, nullsFirst: false })
          .limit(10)
      ).data ?? []
    : [];

  return (
    <div className="space-y-6">
      <RejectionNotices reservations={(rejections ?? []) as unknown as RejectionNotice[]} />

      <section>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
        <PetsRow pets={petRows} selectedId={selected?.id ?? null} />
      </section>

      {clubinho.length > 0 && (
        <section>
          <h2 className="font-heading text-lg font-semibold text-graphite">
            Meu Clubinho
          </h2>
          <p className="text-sm text-gray-neutral">
            Quanto ainda cabe no ciclo de cada pet.
          </p>
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
            {clubinho.map((subscription) => (
              <ClubinhoCard
                key={subscription.id}
                subscription={subscription}
                schedules={clubinhoSchedules.get(subscription.id) ?? []}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-heading text-lg font-semibold text-graphite">
          {selected ? `Atendimentos de ${selected.name}` : "Atendimentos"}
        </h2>
        {appointments.length === 0 ? (
          <p className="mt-3 text-sm text-gray-neutral">
            {selected
              ? `${selected.name} ainda não tem atendimentos. Que tal agendar um?`
              : "Você ainda não tem atendimentos. Que tal agendar um?"}
          </p>
        ) : (
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
            {appointments.map((a) => {
              const service = a.service_type as unknown as { name: string } | null;
              return (
                <Card key={a.id} className="min-w-[15rem] shrink-0 snap-start p-4">
                  <Badge tone={tone[a.status as AppointmentStatus]}>
                    {TUTOR_APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                  </Badge>
                  <p className="mt-2 font-medium text-graphite">{service?.name ?? "Serviço"}</p>
                  <p className="text-xs text-gray-neutral">{formatDate(a.scheduled_at)}</p>
                </Card>
              );
            })}
            {selected && (
              <Link
                href={`/atendimentos?pet=${selected.id}`}
                className="flex min-w-[10rem] shrink-0 snap-start items-center justify-center gap-1 rounded-2xl border border-dashed border-graphite/15 px-4 text-sm font-medium text-petrol transition-colors hover:bg-surface-muted"
              >
                Ver todos <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
