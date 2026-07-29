import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Avatar, Card, RatingStars, StatusChip, TabbedSections } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  type BehaviorSummary,
} from "@mylivepet/types";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import { TutorProfileForm, type TutorProfile } from "@/components/tutor-profile-form";
import { PetDialog, type PetRow } from "@/components/pet-dialog";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: tutor }, { data: pets }] = await Promise.all([
    supabase.from("tutor").select("full_name, email, phone, notes").eq("id", ctx.tutorId).maybeSingle(),
    supabase
      .from("pet")
      .select("id, name, species, breed, size, birth_date, notes, photo_path")
      .eq("tutor_id", ctx.tutorId)
      .order("name"),
  ]);

  const profile: TutorProfile = {
    full_name: tutor?.full_name ?? ctx.fullName,
    email: tutor?.email ?? "",
    phone: tutor?.phone ?? "",
    notes: tutor?.notes ?? "",
  };
  const list = (pets ?? []) as PetRow[];
  const summaries = await fetchBehaviorSummaries(
    supabase,
    list.map((p) => p.id),
  );

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Configurações</h1>
        <p className="text-sm text-gray-neutral">Edite seus dados e os dados dos seus pets.</p>
      </header>

      <TabbedSections
        sections={[
          {
            id: "dados",
            label: "Meus dados",
            content: <TutorProfileForm tutor={profile} />,
          },
          {
            id: "pets",
            label: "Meus pets",
            content: (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-neutral">
                    {list.length === 0
                      ? "Nenhum pet cadastrado."
                      : `${list.length} ${list.length === 1 ? "pet cadastrado" : "pets cadastrados"}.`}
                  </p>
                  <PetDialog />
                </div>

                <div className="space-y-2">
                  {list.map((p) => (
                    <PetSettingsCard
                      key={p.id}
                      pet={p}
                      summary={summaries.get(p.id) ?? null}
                    />
                  ))}
                </div>

                {list.length === 0 && (
                  <p className="text-sm text-gray-neutral">
                    Use o botão acima ou vá para{" "}
                    <Link href="/meus-pets" className="font-medium text-orange">
                      Meus pets
                    </Link>
                    .
                  </p>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/** Linha de pet: identificação à esquerda, boletim abaixo, edição à direita. */
function PetSettingsCard({
  pet,
  summary,
}: {
  pet: PetRow;
  summary: BehaviorSummary | null;
}) {
  const average = summary?.averageScore ?? null;
  const count = summary?.reportCount ?? 0;
  const badge = behaviorBadgeOf(average, count);

  return (
    <Card className="flex items-center gap-3 p-3">
      <Avatar name={pet.name} src={pet.photo_path} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-graphite">{pet.name}</p>
        <p className="truncate text-xs text-gray-neutral">
          {[pet.species, pet.breed].filter(Boolean).join(" · ") || "Pet"}
        </p>
        {average !== null && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <RatingStars value={Math.round(average)} size="sm" />
            <span className="text-xs text-gray-neutral">
              {formatBehaviorScore(average)} · {count}{" "}
              {count === 1 ? "avaliação" : "avaliações"}
            </span>
            {badge && (
              <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                {BEHAVIOR_BADGE_LABEL[badge]}
              </StatusChip>
            )}
          </div>
        )}
      </div>

      <PetDialog pet={pet} />
    </Card>
  );
}
