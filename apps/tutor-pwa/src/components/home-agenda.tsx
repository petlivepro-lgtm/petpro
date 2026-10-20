import Link from "next/link";
import { ArrowRight, CalendarPlus, ChevronRight, Crown, Star } from "lucide-react";
import { Avatar, Badge, cn } from "@mylivepet/ui";
import {
  TUTOR_APPOINTMENT_STATUS_LABEL,
  TUTOR_APPOINTMENT_STATUS_TONE,
} from "@/lib/status-labels";
import {
  appointmentHref,
  joinServices,
  relativeDay,
  shortDay,
  timeOf,
  type HomeVisit,
  type ReviewReminder,
} from "@/lib/home";
import { DateTile } from "./date-tile";

export const sectionTitle = "font-heading text-lg font-semibold text-graphite";
export const sectionLink =
  "inline-flex items-center gap-1 text-sm font-medium text-petrol hover:underline";

/**
 * O próximo horário marcado de qualquer pet do tutor. Sem horário, vira o
 * convite para agendar — lembrando o saldo do Clubinho quando ainda sobra.
 */
export function NextVisit({
  visit,
  othersCount,
  clubinhoHint,
}: {
  visit: HomeVisit | null;
  othersCount: number;
  clubinhoHint: string | null;
}) {
  return (
    <section className="flex flex-col">
      <h2 className={sectionTitle}>Próximo horário</h2>

      {visit && visit.scheduledAt ? (
        <div className="mt-3 flex flex-1 flex-col gap-2">
          <Link
            href={appointmentHref(visit.pet.id, visit.id)}
            className="group flex flex-1 items-center gap-4 rounded-2xl border border-graphite/5 bg-surface p-4 shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <DateTile iso={visit.scheduledAt} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-orange">
                {relativeDay(visit.scheduledAt)} · {timeOf(visit.scheduledAt)}
              </p>
              <p className="mt-0.5 truncate font-heading font-semibold text-graphite">
                {joinServices(visit.services)}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-neutral">
                  <Avatar name={visit.pet.name} src={visit.pet.photo_path} size="sm" className="h-6 w-6 text-[10px]" />
                  <span className="truncate">{visit.pet.name}</span>
                </span>
                <Badge tone={TUTOR_APPOINTMENT_STATUS_TONE[visit.status]}>
                  {TUTOR_APPOINTMENT_STATUS_LABEL[visit.status]}
                </Badge>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-neutral transition-transform group-hover:translate-x-0.5" />
          </Link>

          {visit.status === "REQUESTED" && (
            <p className="px-1 text-xs text-gray-neutral">
              O petshop ainda vai confirmar este horário. Você recebe um aviso quando ele responder.
            </p>
          )}
          {othersCount > 0 && (
            <Link href="/atendimentos" className={cn(sectionLink, "px-1")}>
              Mais {othersCount} {othersCount === 1 ? "horário marcado" : "horários marcados"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col items-start gap-3 rounded-2xl border border-dashed border-graphite/15 bg-surface p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petrol/[0.07] text-petrol">
            <CalendarPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-semibold text-graphite">Nenhum horário marcado</p>
            {clubinhoHint ? (
              <p className="mt-0.5 flex items-start gap-1.5 text-sm text-gray-neutral">
                <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-petrol" />
                {clubinhoHint}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-gray-neutral">
                Escolha o serviço e o horário. O petshop confirma pelo app.
              </p>
            )}
          </div>
          <Link
            href="/agendar"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-orange/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
          >
            Agendar
          </Link>
        </div>
      )}
    </section>
  );
}

const REVIEWS_SHOWN = 3;

/** Concluídos que ainda esperam a avaliação do tutor. */
export function ReviewReminders({ reviews }: { reviews: ReviewReminder[] }) {
  if (reviews.length === 0) return null;
  const shown = reviews.slice(0, REVIEWS_SHOWN);
  const rest = reviews.length - shown.length;

  return (
    <section className="flex flex-col">
      <h2 className={sectionTitle}>Como foi?</h2>
      <p className="text-sm text-gray-neutral">Sua avaliação vai direto para o petshop.</p>

      <ul className="mt-3 flex-1 divide-y divide-graphite/5 overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
        {shown.map((review) => (
          <li key={review.id}>
            <Link
              href={appointmentHref(review.pet.id, review.id)}
              className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
            >
              <Avatar name={review.pet.name} src={review.pet.photo_path} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-graphite">
                  {review.serviceName} de {review.pet.name}
                </p>
                <p className="text-xs text-gray-neutral">Concluído em {shortDay(review.finishedAt)}</p>
              </div>
              <span className="flex shrink-0 items-center gap-0.5 text-warning" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-3.5 w-3.5 transition-[fill] group-hover:fill-current"
                    style={{ transitionDelay: `${i * 40}ms` }}
                  />
                ))}
              </span>
              <span className="sr-only">Avaliar</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-neutral" />
            </Link>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <Link href="/atendimentos" className={cn(sectionLink, "mt-2 px-1")}>
          Mais {rest} para avaliar <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}
