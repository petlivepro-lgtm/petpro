"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Card, Avatar, RatingStars, StatusChip, cn } from "@mylivepet/ui";
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

/**
 * Fileira de pets da home; o pet selecionado define o histórico de atendimentos
 * logo abaixo, sem sair da tela. A média do boletim aparece no card — a ficha
 * completa fica em Meus pets.
 */
export function PetsRow({
  pets,
  selectedId,
}: {
  pets: PetRowItem[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (pets.length === 0) {
    return (
      <p className="mt-3 text-sm text-gray-neutral">Nenhum pet cadastrado.</p>
    );
  }

  function select(id: string) {
    if (id === selectedId) return;
    startTransition(() => router.replace(`/?pet=${id}`, { scroll: false }));
  }

  return (
    <div
      className={cn(
        "mt-3 flex gap-3 overflow-x-auto py-1 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      {pets.map((p) => {
        const active = p.id === selectedId;
        const average = p.summary?.averageScore ?? null;
        const count = p.summary?.reportCount ?? 0;
        const badge = behaviorBadgeOf(average, count);

        return (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => select(p.id)}
            className="shrink-0 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Card
              className={cn(
                "min-w-[11rem] p-4 transition-all",
                active
                  ? "border-orange/40 bg-orange/[0.025] shadow-card-hover"
                  : "hover:border-graphite/10 hover:shadow-card-hover",
              )}
            >
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
          </button>
        );
      })}
    </div>
  );
}
