import Link from "next/link";
import { ListChecks, MapPin, Play } from "lucide-react";
import { Avatar, cn } from "@mylivepet/ui";
import type { Chegada } from "@/lib/chegada";
import { appointmentHref, joinServices, timeOf, type HomeVisit } from "@/lib/home";

/**
 * O que está acontecendo com o pet agora: atendimento em andamento (com o
 * botão do ao vivo quando há câmera), pet já no petshop ou o leva-e-traz a
 * caminho. É o primeiro bloco da home — quando existe, é a razão de o tutor
 * ter aberto o app.
 */
export function HomeNow({
  visits,
  chegada,
}: {
  visits: HomeVisit[];
  chegada: Chegada | null;
}) {
  if (visits.length === 0 && !chegada) return null;

  return (
    <section aria-label="Agora" className="space-y-3">
      {visits.map((visit) => (
        <VisitNowCard key={visit.id} visit={visit} />
      ))}
      {chegada && <OnTheWayCard chegada={chegada} />}
    </section>
  );
}

function NowShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-petrol p-5 text-white shadow-card lg:p-6">{children}</div>
  );
}

function NowPill({ live, children }: { live?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
      <span className="relative flex h-2 w-2">
        {live && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-orange opacity-75 motion-safe:animate-ping" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            live ? "bg-orange" : "bg-white/70",
          )}
        />
      </span>
      {children}
    </span>
  );
}

const primaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-orange/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-petrol";
const secondaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 text-sm font-medium text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-petrol";

function VisitNowCard({ visit }: { visit: HomeVisit }) {
  const inProgress = visit.status === "IN_PROGRESS";
  const services = joinServices(visit.services);
  const done = visit.steps.filter((s) => s.done).length;
  const current = visit.steps.find((s) => !s.done) ?? null;

  return (
    <NowShell>
      <div className="flex items-start gap-4">
        <Avatar
          name={visit.pet.name}
          src={visit.pet.photo_path}
          size="lg"
          className="bg-white/10 text-white ring-2 ring-white/15"
        />
        <div className="min-w-0 flex-1">
          <NowPill live={inProgress}>
            {inProgress ? (visit.hasCamera ? "Ao vivo agora" : "Em atendimento") : "No petshop"}
          </NowPill>
          <p className="mt-2 font-heading text-lg font-bold leading-snug text-balance lg:text-xl">
            {inProgress
              ? `${visit.pet.name} está em atendimento`
              : `${visit.pet.name} já está no petshop`}
          </p>
          <p className="mt-0.5 text-sm text-white/75">
            {services}
            {inProgress
              ? visit.startedAt && ` · começou às ${timeOf(visit.startedAt)}`
              : visit.scheduledAt && ` · horário das ${timeOf(visit.scheduledAt)}`}
          </p>
        </div>
      </div>

      {inProgress && visit.steps.length > 0 && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-white/90">
              {current ? (
                <>
                  Agora: <strong className="font-semibold text-white">{current.label}</strong>
                </>
              ) : (
                "Etapas concluídas, finalizando"
              )}
            </span>
            <span className="shrink-0 tabular-nums text-white/70">
              {done} de {visit.steps.length}
            </span>
          </div>
          <div className="mt-2 flex gap-1" aria-hidden>
            {visit.steps.map((step, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  step.done ? "bg-orange" : step === current ? "bg-white/45" : "bg-white/15",
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {inProgress && visit.hasCamera ? (
          <Link href="/ao-vivo" className={primaryAction}>
            <Play className="h-4 w-4 fill-current" /> Assistir ao vivo
          </Link>
        ) : null}
        <Link href={appointmentHref(visit.pet.id, visit.id)} className={secondaryAction}>
          <ListChecks className="h-4 w-4" /> Ver atendimento
        </Link>
      </div>
    </NowShell>
  );
}

function OnTheWayCard({ chegada }: { chegada: Chegada }) {
  const pickup = chegada.kind === "PICKUP";

  return (
    <NowShell>
      <div className="flex items-start gap-4">
        <Avatar
          name={chegada.petName}
          src={chegada.petPhoto}
          size="lg"
          className="bg-white/10 text-white ring-2 ring-white/15"
        />
        <div className="min-w-0 flex-1">
          <NowPill live>A caminho</NowPill>
          <p className="mt-2 font-heading text-lg font-bold leading-snug text-balance lg:text-xl">
            {pickup
              ? `O leva-e-traz está indo buscar ${chegada.petName}`
              : `${chegada.petName} está voltando para casa`}
          </p>
          <p className="mt-0.5 text-sm text-white/75">
            {chegada.etaAt
              ? `Previsão de chegada às ${timeOf(chegada.etaAt)}`
              : "Acompanhe o trajeto em tempo real"}
          </p>
        </div>
      </div>
      <div className="mt-5">
        <Link href="/a-caminho" className={primaryAction}>
          <MapPin className="h-4 w-4" /> Acompanhar no mapa
        </Link>
      </div>
    </NowShell>
  );
}
