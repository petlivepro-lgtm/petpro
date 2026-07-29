import Link from "next/link";
import { Card, Avatar, RatingStars, StatusChip } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  type BehaviorSummary,
} from "@mylivepet/types";

export type PetRowItem = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  photo_path: string | null;
  summary: BehaviorSummary | null;
};

/** Fileira de pets da home; cada card leva à ficha do pet. */
export function PetsRow({ pets }: { pets: PetRowItem[] }) {
  if (pets.length === 0) {
    return (
      <p className="mt-3 text-sm text-gray-neutral">Nenhum pet cadastrado.</p>
    );
  }

  return (
    <div className="mt-3 flex gap-3 overflow-x-auto py-1">
      {pets.map((p) => {
        const average = p.summary?.averageScore ?? null;
        const count = p.summary?.reportCount ?? 0;
        const badge = behaviorBadgeOf(average, count);

        return (
          <Link
            key={p.id}
            href={`/pets/${p.id}`}
            className="shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Card className="min-w-[11rem] p-4 transition-all hover:border-orange/30 hover:shadow-card-hover">
              <Avatar name={p.name} src={p.photo_path} size="lg" />
              <p className="mt-2 truncate font-heading font-semibold text-graphite">
                {p.name}
              </p>
              <p className="truncate text-xs text-gray-neutral">
                {p.breed ?? p.species ?? "Pet"}
              </p>

              {average !== null ? (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <RatingStars value={Math.round(average)} size="sm" />
                    <span className="text-xs text-gray-neutral">
                      {formatBehaviorScore(average)}
                    </span>
                  </div>
                  {badge && (
                    <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                      {BEHAVIOR_BADGE_LABEL[badge]}
                    </StatusChip>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-neutral">
                  Ainda sem boletim
                </p>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
