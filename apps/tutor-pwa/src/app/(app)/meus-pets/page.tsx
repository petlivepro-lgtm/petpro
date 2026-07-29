import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Avatar, Card, RatingStars, StatusChip } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
} from "@mylivepet/types";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import { PetDialog, type PetRow } from "@/components/pet-dialog";

const SIZE_LABEL: Record<string, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

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
  const summaries = await fetchBehaviorSummaries(
    supabase,
    list.map((p) => p.id),
  );

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
                  {[p.species, p.breed, p.size ? SIZE_LABEL[p.size] : null]
                    .filter(Boolean)
                    .join(" · ") || "Pet"}
                </p>
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
              <PetDialog pet={p} />
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
