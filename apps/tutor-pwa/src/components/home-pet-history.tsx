import Link from "next/link";
import { ArrowRight, ChevronRight, ClipboardList } from "lucide-react";
import { Badge, cn } from "@mylivepet/ui";
import type { AppointmentStatus } from "@mylivepet/types";
import {
  TUTOR_APPOINTMENT_STATUS_LABEL,
  TUTOR_APPOINTMENT_STATUS_TONE,
} from "@/lib/status-labels";
import { appointmentHref, shortDay, timeOf } from "@/lib/home";
import { DateTile } from "./date-tile";
import { sectionLink, sectionTitle } from "./home-agenda";

export type PetHistoryItem = {
  id: string;
  status: AppointmentStatus;
  scheduledAt: string | null;
  finishedAt: string | null;
  serviceName: string;
  photos: string[];
};

const HISTORY_SHOWN = 5;
const MOMENTS_SHOWN = 6;

/**
 * Histórico do pet escolhido na fileira de pets: os últimos atendimentos em
 * lista e, ao lado, as fotos que o petshop registrou neles.
 */
export function PetHistory({
  pet,
  items,
}: {
  pet: { id: string; name: string };
  items: PetHistoryItem[];
}) {
  const moments = items
    .filter((a) => a.status === "COMPLETED")
    .flatMap((a) =>
      a.photos.map((src) => ({
        src,
        appointmentId: a.id,
        caption: `${a.serviceName} · ${shortDay(a.finishedAt ?? a.scheduledAt)}`,
      })),
    )
    .slice(0, MOMENTS_SHOWN);

  if (items.length === 0) {
    return (
      <section>
        <h2 className={sectionTitle}>Atendimentos de {pet.name}</h2>
        <div className="mt-3 flex flex-col items-start gap-3 rounded-2xl border border-dashed border-graphite/15 bg-surface p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petrol/[0.07] text-petrol">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-semibold text-graphite">
              {pet.name} ainda não tem atendimentos
            </p>
            <p className="mt-0.5 text-sm text-gray-neutral">
              Depois do primeiro, as etapas, as fotos e o boletim aparecem aqui.
            </p>
          </div>
          {/* Agendar fica só no "Próximo horário": aqui o caminho é a ficha,
              onde o tutor confere e completa os dados do pet. */}
          <Link
            href={`/pets/${pet.id}`}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-graphite/10 bg-surface-muted px-5 text-sm font-medium text-graphite transition-colors hover:bg-gray-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-graphite focus-visible:ring-offset-2"
          >
            Ver ficha de {pet.name} <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    );
  }

  const shown = items.slice(0, HISTORY_SHOWN);

  return (
    <div
      className={cn(
        "grid gap-8",
        moments.length > 0 && "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6",
      )}
    >
      <section className="min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={cn(sectionTitle, "min-w-0 truncate")}>Atendimentos de {pet.name}</h2>
          <Link href={`/atendimentos?pet=${pet.id}`} className={cn(sectionLink, "shrink-0")}>
            Ver todos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <ul className="mt-3 divide-y divide-graphite/5 overflow-hidden rounded-2xl border border-graphite/5 bg-surface shadow-card">
          {shown.map((a) => {
            const when = a.finishedAt ?? a.scheduledAt;
            return (
              <li key={a.id}>
                <Link
                  href={appointmentHref(pet.id, a.id)}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
                >
                  {when ? (
                    <DateTile iso={when} size="sm" />
                  ) : (
                    <span className="h-12 w-12 shrink-0 rounded-xl bg-petrol/[0.07]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-graphite">{a.serviceName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {when && <span className="text-xs tabular-nums text-gray-neutral">{timeOf(when)}</span>}
                      <Badge tone={TUTOR_APPOINTMENT_STATUS_TONE[a.status]}>
                        {TUTOR_APPOINTMENT_STATUS_LABEL[a.status]}
                      </Badge>
                    </div>
                  </div>
                  {a.status === "COMPLETED" && a.photos[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.photos[0]}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-neutral transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {moments.length > 0 && (
        <section className="min-w-0">
          <h2 className={sectionTitle}>Fotos de {pet.name}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {moments.map((m, i) => {
              const featured = i === 0 && moments.length >= 3;
              return (
                <Link
                  key={`${m.appointmentId}-${i}`}
                  href={appointmentHref(pet.id, m.appointmentId)}
                  className={cn(
                    "group relative block aspect-square overflow-hidden rounded-xl bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
                    featured && "col-span-2 row-span-2",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.src}
                    alt={`${pet.name} — ${m.caption}`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                  />
                  {featured && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-graphite/70 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white">
                      {m.caption}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
