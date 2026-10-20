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
  type ClubinhoScheduleDTO,
  type ClubinhoSubscriptionDTO,
} from "@mylivepet/types";
import { ClubinhoBalance } from "./clubinho-balance";

export type PetRowItem = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  photo_path: string | null;
  summary: BehaviorSummary | null;
  /** Assinaturas do Clubinho deste pet, com os horários fixos de cada uma. */
  clubinho: { subscription: ClubinhoSubscriptionDTO; schedules: ClubinhoScheduleDTO[] }[];
};

/**
 * Os pets da home, um card por pet com o boletim e o saldo do Clubinho. Com
 * mais de um pet, o card escolhido define o histórico de atendimentos logo
 * abaixo, sem sair da tela; com um só, não há o que escolher e o card não
 * se comporta como botão.
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

  const selectable = pets.length > 1;
  // Pet único com Clubinho: o card ocupa a linha, com o saldo ao lado do pet.
  const wide = pets.length === 1 && pets[0]!.clubinho.length > 0;

  function select(id: string) {
    if (id === selectedId) return;
    startTransition(() => router.replace(`/?pet=${id}`, { scroll: false }));
  }

  return (
    <div
      className={cn(
        "mt-3 grid gap-3 transition-opacity",
        !wide && "sm:grid-cols-2",
        isPending && "opacity-60",
      )}
    >
      {pets.map((p) => {
        const active = selectable && p.id === selectedId;
        const card = <PetCard pet={p} active={active} wide={wide} interactive={selectable} />;

        return selectable ? (
          <button
            key={p.id}
            type="button"
            aria-pressed={active}
            onClick={() => select(p.id)}
            className="flex rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            {card}
          </button>
        ) : (
          <div key={p.id} className="flex">
            {card}
          </div>
        );
      })}
    </div>
  );
}

function PetCard({
  pet,
  active,
  wide,
  interactive,
}: {
  pet: PetRowItem;
  active: boolean;
  wide: boolean;
  interactive: boolean;
}) {
  const average = pet.summary?.averageScore ?? null;
  const count = pet.summary?.reportCount ?? 0;
  const badge = behaviorBadgeOf(average, count);

  return (
    <Card
      className={cn(
        "w-full transition-colors",
        wide && "sm:flex sm:items-stretch sm:gap-6",
        active && "border-orange/40 bg-orange/[0.03] ring-1 ring-orange/20",
        interactive && !active && "hover:border-graphite/15",
      )}
    >
      <div className={cn("flex items-center gap-4", wide && "sm:w-64 sm:shrink-0")}>
        <Avatar name={pet.name} src={pet.photo_path} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-lg font-semibold text-graphite">
            {pet.name}
          </p>
          <p className="truncate text-sm text-gray-neutral">
            {pet.breed ?? pet.species ?? "Pet"}
          </p>
          {average !== null ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="flex items-center gap-1.5">
                <RatingStars value={Math.round(average)} size="sm" />
                <span className="text-xs tabular-nums text-gray-neutral">
                  {formatBehaviorScore(average)}
                </span>
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
        </div>
      </div>

      {pet.clubinho.length > 0 && (
        <div
          className={cn(
            "mt-4 space-y-4 border-t border-graphite/5 pt-4",
            wide && "sm:mt-0 sm:flex-1 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0",
          )}
        >
          {pet.clubinho.map(({ subscription, schedules }) => (
            <ClubinhoBalance
              key={subscription.id}
              subscription={subscription}
              schedules={schedules}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
