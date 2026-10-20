import Link from "next/link";
import { CalendarClock, ChevronRight, Star } from "lucide-react";
import { Avatar, Card, StatusChip } from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  petSizeLabel,
  type BehaviorSummary,
  type ClubinhoScheduleDTO,
  type ClubinhoSubscriptionDTO,
} from "@mylivepet/types";
import { ageFrom } from "@/lib/pet-age";
import { relativeDay, shortDay, timeOf } from "@/lib/home";
import { PetDialog, type PetRow } from "./pet-dialog";
import { DeletePetDialog } from "./delete-pet-dialog";
import { ClubinhoBalance } from "./clubinho-balance";

export type PetActivity = {
  /** Todos os atendimentos, de qualquer status — é o que trava a exclusão. */
  total: number;
  completed: number;
  lastVisit: string | null;
  next: { at: string; service: string } | null;
};

/**
 * Card de um pet em Meus pets: quem ele é, o resumo do boletim e das visitas,
 * o próximo horário, o saldo do Clubinho e o que ainda falta na ficha.
 */
export function MyPetCard({
  pet: p,
  summary,
  activity: a,
  subscription,
  schedules,
}: {
  pet: PetRow;
  summary: BehaviorSummary | null;
  activity: PetActivity;
  subscription: ClubinhoSubscriptionDTO | null;
  schedules: ClubinhoScheduleDTO[];
}) {
  const average = summary?.averageScore ?? null;
  const badge = behaviorBadgeOf(average, summary?.reportCount ?? 0);
  const meta = [p.species, p.breed, petSizeLabel(p.size)].filter(Boolean).join(" · ");
  const age = ageFrom(p.birth_date);
  const missing = [
    !p.photo_path && "foto",
    !p.size && "porte",
    !p.birth_date && "nascimento",
  ].filter(Boolean) as string[];
  const hasBody = Boolean(a.next || subscription || p.notes || missing.length > 0);

  return (
    <Card className="flex flex-col overflow-hidden p-0">
      <div className="flex items-start gap-3 p-5 pb-4">
        {/* A identidade leva à ficha; lápis e lixeira ficam à parte. */}
        <Link
          href={`/pets/${p.id}`}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <Avatar name={p.name} src={p.photo_path} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate font-heading text-lg font-semibold text-graphite">
                {p.name}
              </p>
              {badge && (
                <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                  {BEHAVIOR_BADGE_LABEL[badge]}
                </StatusChip>
              )}
            </div>
            <p className="text-sm text-gray-neutral">{meta || "Pet"}</p>
            {age && <p className="text-sm text-gray-neutral">{age}</p>}
          </div>
        </Link>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center">
          <PetDialog pet={p} />
          <DeletePetDialog
            petId={p.id}
            petName={p.name}
            appointmentCount={a.total}
            hasClubinho={subscription !== null}
          />
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-graphite/5 border-y border-graphite/5 bg-surface-muted/50">
        <div className="px-4 py-3">
          <dt className="text-xs text-gray-neutral">Boletim</dt>
          <dd className="mt-0.5 flex items-center gap-1 font-heading font-semibold tabular-nums text-graphite">
            {average !== null ? (
              <>
                <Star className="h-4 w-4 fill-orange text-orange" aria-hidden />
                {formatBehaviorScore(average)}
              </>
            ) : (
              <span className="text-gray-neutral">—</span>
            )}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-gray-neutral">Atendimentos</dt>
          <dd className="mt-0.5 font-heading font-semibold tabular-nums text-graphite">
            {a.completed}
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-gray-neutral">Última visita</dt>
          <dd className="mt-0.5 font-heading font-semibold tabular-nums text-graphite">
            {a.lastVisit ? shortDay(a.lastVisit) : <span className="text-gray-neutral">—</span>}
          </dd>
        </div>
      </dl>

      {hasBody && (
        <div className="flex-1 space-y-4 p-5">
          {a.next && (
            <p className="flex items-start gap-2 text-sm text-graphite">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-petrol" aria-hidden />
              <span>
                Próximo horário:{" "}
                <strong className="font-semibold">
                  {relativeDay(a.next.at)}, {shortDay(a.next.at)} às {timeOf(a.next.at)}
                </strong>{" "}
                · {a.next.service}
              </span>
            </p>
          )}

          {subscription && (
            <ClubinhoBalance
              subscription={subscription}
              schedules={schedules}
            />
          )}

          {p.notes && (
            <p className="line-clamp-2 text-sm text-gray-neutral">{p.notes}</p>
          )}

          {missing.length > 0 && (
            <p className="text-xs text-gray-neutral">
              Falta na ficha: {missing.join(", ")}. <PetDialog pet={p} trigger="link" />
            </p>
          )}
        </div>
      )}

      <Link
        href={`/pets/${p.id}`}
        className="mt-auto flex items-center justify-between border-t border-graphite/5 px-5 py-3 text-sm font-medium text-petrol transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
      >
        Ver ficha completa
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}
