import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, ClipboardList } from "lucide-react";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  RatingStars,
  StatusChip,
  TabbedSections,
} from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  type AppointmentStatus,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { TUTOR_APPOINTMENT_STATUS_LABEL } from "@/lib/status-labels";
import { fetchBehaviorSummaries, fetchPetBehaviorReports } from "@/lib/behavior";
import { BehaviorReportView } from "@/components/behavior-report-view";
import { PetDialog, type PetRow } from "@/components/pet-dialog";

const SIZE_LABEL: Record<string, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

const tone: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

/** Idade a partir da data de nascimento, em anos e meses. */
function ageFrom(birth: string | null): string | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let months =
    (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return (
    [
      y > 0 ? `${y} ano${y > 1 ? "s" : ""}` : null,
      m > 0 ? `${m} mes${m > 1 ? "es" : ""}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "recém-nascido"
  );
}

export default async function PetProfilePage({
  params,
}: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await params;
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  // A RLS já limita aos pets do tutor; o eq explícito evita 500 vazio em id alheio.
  const { data: pet } = await supabase
    .from("pet")
    .select("id, name, species, breed, size, birth_date, notes, photo_path")
    .eq("id", petId)
    .eq("tutor_id", ctx.tutorId)
    .maybeSingle();

  if (!pet) notFound();

  const [reports, summaries, { data: appts }] = await Promise.all([
    fetchPetBehaviorReports(supabase, petId),
    fetchBehaviorSummaries(supabase, [petId]),
    supabase
      .from("appointment")
      .select("id, status, scheduled_at, finished_at, service_type(name)")
      .eq("pet_id", petId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(20),
  ]);

  const summary = summaries.get(petId) ?? null;
  const average = summary?.averageScore ?? null;
  const count = summary?.reportCount ?? 0;
  const badge = behaviorBadgeOf(average, count);

  const meta = [pet.species, pet.breed, pet.size ? SIZE_LABEL[pet.size] : null]
    .filter(Boolean)
    .join(" · ");
  const age = ageFrom(pet.birth_date);
  const appointments = appts ?? [];

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <Link
        href="/meus-pets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-neutral hover:text-graphite"
      >
        <ArrowLeft className="h-4 w-4" /> Meus pets
      </Link>

      {/* Cabeçalho da ficha */}
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={pet.name} src={pet.photo_path} size="xl" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-graphite">
                {pet.name}
              </h1>
              {badge && (
                <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                  {BEHAVIOR_BADGE_LABEL[badge]}
                </StatusChip>
              )}
            </div>

            {meta && <p className="text-sm text-gray-neutral">{meta}</p>}
            {age && <p className="text-sm text-gray-neutral">{age}</p>}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {average !== null ? (
                <>
                  <RatingStars value={Math.round(average)} size="sm" />
                  <span className="text-sm text-gray-neutral">
                    {formatBehaviorScore(average)} · {count}{" "}
                    {count === 1 ? "avaliação" : "avaliações"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-neutral">
                  Ainda sem boletim
                </span>
              )}
            </div>

            {pet.notes && (
              <p className="mt-3 border-t border-graphite/5 pt-3 text-sm text-gray-neutral">
                {pet.notes}
              </p>
            )}
          </div>

          <PetDialog pet={pet as PetRow} />
        </div>
      </Card>

      <TabbedSections
        sections={[
          {
            id: "boletim",
            label: "Boletim",
            content: (
              <BehaviorReportView reports={reports} petName={pet.name} />
            ),
          },
          {
            id: "atendimentos",
            label: "Atendimentos",
            content:
              appointments.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="h-6 w-6" />}
                  title="Nenhum atendimento ainda"
                  description={`Quando ${pet.name} for atendido, o histórico aparece aqui.`}
                />
              ) : (
                <div className="space-y-2">
                  {appointments.map((a) => {
                    const service = a.service_type as unknown as {
                      name: string;
                    } | null;
                    const status = a.status as AppointmentStatus;
                    return (
                      <Card
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-graphite">
                            {service?.name ?? "Serviço"}
                          </p>
                          <p className="text-xs text-gray-neutral">
                            {fmt(a.finished_at ?? a.scheduled_at)}
                          </p>
                        </div>
                        <Badge tone={tone[status]}>
                          {TUTOR_APPOINTMENT_STATUS_LABEL[status]}
                        </Badge>
                      </Card>
                    );
                  })}

                  <Link
                    href={`/atendimentos?pet=${pet.id}`}
                    className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-petrol hover:underline"
                  >
                    <ClipboardList className="h-4 w-4" /> Ver detalhes dos
                    atendimentos
                  </Link>
                </div>
              ),
          },
        ]}
      />
    </div>
  );
}
