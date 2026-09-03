import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Avatar, Card, RatingStars, StatusChip } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  formatSchedule,
  petSizeLabel,
} from "@mylivepet/types";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import {
  loadMyClubinho,
  loadMyClubinhoSchedules,
  syncClubinhoPeriods,
} from "@/lib/clubinho";
import { PetDialog, type PetRow } from "@/components/pet-dialog";
import { ClubinhoBadge } from "@/components/clubinho-badge";
import { DeletePetDialog } from "@/components/delete-pet-dialog";

export default async function MeusPetsPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: pets } = await supabase
    .from("pet")
    .select("id, name, species, breed, size, birth_date, notes, photo_path")
    .eq("tutor_id", ctx.tutorId)
    .order("name");

  const list = (pets ?? []) as PetRow[];

  // Renova os ciclos vencidos antes de ler o saldo — mesma rotina da home
  // (ver syncClubinhoPeriods).
  await syncClubinhoPeriods(supabase, ctx.tenantId);
  const [summaries, clubinho, { data: appts }] = await Promise.all([
    fetchBehaviorSummaries(
      supabase,
      list.map((p) => p.id),
    ),
    loadMyClubinho(supabase, ctx.tutorId),
    // Quantos atendimentos cada pet já teve. É o que decide se o tutor ainda
    // pode excluir a ficha sozinho (pet_delete_guard, 0051) — e o número
    // aparece no aviso, para "tem histórico" não soar arbitrário.
    supabase
      .from("appointment")
      .select("pet_id")
      .eq("tutor_id", ctx.tutorId),
  ]);
  const clubinhoByPet = new Map(clubinho.map((s) => [s.pet_id, s] as const));

  // Combinados por PET (a consulta devolve por assinatura), para o card dizer
  // quando o pet é atendido sem o tutor precisar abrir a agenda.
  const schedulesBySubscription = await loadMyClubinhoSchedules(
    supabase,
    clubinho.map((s) => s.id),
  );
  const schedulesByPet = new Map(
    clubinho.map(
      (s) => [s.pet_id, schedulesBySubscription.get(s.id) ?? []] as const,
    ),
  );
  const appointmentsByPet = new Map<string, number>();
  for (const row of appts ?? []) {
    appointmentsByPet.set(row.pet_id, (appointmentsByPet.get(row.pet_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
          <p className="text-sm text-gray-neutral">
            Cadastre seus pets — eles ficam disponíveis para agendar e visíveis ao petshop.
          </p>
        </div>
        <PetDialog />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const summary = summaries.get(p.id) ?? null;
          const badge = behaviorBadgeOf(
            summary?.averageScore ?? null,
            summary?.reportCount ?? 0,
          );
          return (
            <Card key={p.id} className="flex items-start justify-between gap-3 p-4">
              {/* O card inteiro leva à ficha; o lápis continua editando inline. */}
              <Link
                href={`/pets/${p.id}`}
                className="min-w-0 flex-1 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <Avatar name={p.name} src={p.photo_path} size="lg" />
                <p className="mt-1 font-heading font-semibold text-graphite">{p.name}</p>
                <p className="text-xs text-gray-neutral">
                  {[p.species, p.breed, petSizeLabel(p.size)]
                    .filter(Boolean)
                    .join(" · ") || "Pet"}
                </p>
                <ClubinhoBadge
                  subscription={clubinhoByPet.get(p.id)}
                  className="mt-1.5"
                />
                {(schedulesByPet.get(p.id) ?? []).map((schedule) => (
                  <p key={schedule.id} className="text-xs text-petrol">
                    {formatSchedule(schedule)} · {schedule.service_name}
                  </p>
                ))}
                {summary?.averageScore != null ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <RatingStars value={Math.round(summary.averageScore)} size="sm" />
                    <span className="text-xs text-gray-neutral">
                      {formatBehaviorScore(summary.averageScore)} ·{" "}
                      {summary.reportCount}{" "}
                      {summary.reportCount === 1 ? "avaliação" : "avaliações"}
                    </span>
                    {badge && (
                      <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                        {BEHAVIOR_BADGE_LABEL[badge]}
                      </StatusChip>
                    )}
                  </div>
                ) : (
                  <p className="mt-1.5 text-xs text-gray-neutral">Ainda sem boletim</p>
                )}
              </Link>
              <div className="flex shrink-0 items-center">
                <PetDialog pet={p} />
                <DeletePetDialog
                  petId={p.id}
                  petName={p.name}
                  appointmentCount={appointmentsByPet.get(p.id) ?? 0}
                  hasClubinho={clubinhoByPet.has(p.id)}
                />
              </div>
            </Card>
          );
        })}
      </div>

      {list.length === 0 && (
        <Card className="p-6 text-center text-sm text-gray-neutral">
          Você ainda não cadastrou nenhum pet. Use o botão “Cadastrar pet”.
        </Card>
      )}
    </div>
  );
}
