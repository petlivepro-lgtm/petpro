import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Avatar, EmptyState, cn } from "@mylivepet/ui";
import {
  feedbackConfigSchema,
  type AppointmentStatus,
  type BehaviorResponse,
  type FeedbackField,
  type FeedbackResponse,
} from "@mylivepet/types";
import Link from "next/link";
import { ClipboardList, Star } from "lucide-react";
import { AppointmentHistoryCard } from "@/components/appointment-history-card";
import { AppointmentsDateFilter } from "@/components/appointments-date-filter";
import { dayAndTime, monthLabel, timeOf, weekdayAndTime } from "@/lib/home";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CANCEL_ERRORS: Record<string, string> = {
  motivo: "Escreva o motivo do cancelamento para o petshop.",
  cancelamento:
    "Não foi possível cancelar. O atendimento pode já ter começado — fale com o petshop.",
  "1": "Não foi possível cancelar. Tente novamente.",
};

/** Ainda vai acontecer (ou está acontecendo): vai para "Próximos", em ordem de data. */
const OPEN_STATUSES: AppointmentStatus[] = ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"];

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    pet?: string;
    erro?: string;
    cancelado?: string;
    abrir?: string;
  }>;
}) {
  const { from, to, pet: petId, erro, cancelado, abrir } = await searchParams;
  const fromDate = from && ISO_DATE.test(from) ? from : undefined;
  const toDate = to && ISO_DATE.test(to) ? to : undefined;

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  let query = supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, finished_at, photos, request_group_id, cancellation_reason, cancelled_at, cancelled_by_role, pet:pet_id(name), service_type(name), feedback(direction, rating, comment, responses), pet_behavior_report(overall_score, responses, note), appointment_step(id, label, done_at, position)",
    )
    .eq("tutor_id", ctx.tutorId);

  // Filtra pela data do agendamento (scheduled_at); "Até" cobre o dia inteiro.
  if (fromDate) query = query.gte("scheduled_at", fromDate);
  if (toDate) query = query.lte("scheduled_at", `${toDate}T23:59:59`);
  // Filtro por pet (vindo da home); a RLS + tutor_id já restringem ao próprio tutor.
  if (petId) query = query.eq("pet_id", petId);

  // Os pets viram os chips de filtro; o formulário de avaliação configurado
  // pelo petshop vem junto (vazio → padrão no card).
  const [{ data }, { data: pets }, { data: tenantRow }] = await Promise.all([
    query.order("scheduled_at", { ascending: false, nullsFirst: false }).limit(50),
    supabase
      .from("pet")
      .select("id, name, photo_path")
      .eq("tutor_id", ctx.tutorId)
      .order("name"),
    supabase.from("tenant").select("settings").eq("id", ctx.tenantId).maybeSingle(),
  ]);

  const rows = data ?? [];
  const hasFilter = Boolean(fromDate || toDate || petId);

  // Um agendamento só pode ser desmarcado pelo app antes de começar e antes do
  // horário chegar — a RPC cancel_appointment (0055) repete a regra no banco.
  const now = Date.now();
  const cancelable = (row: { status: string; scheduled_at: string | null }) =>
    (row.status === "REQUESTED" || row.status === "CONFIRMED") &&
    !!row.scheduled_at &&
    new Date(row.scheduled_at).getTime() > now;

  const fbConfig = feedbackConfigSchema.safeParse(
    (tenantRow?.settings as { feedback?: unknown } | null)?.feedback,
  );
  const feedbackFields: FeedbackField[] = fbConfig.success ? fbConfig.data.fields : [];

  // Nome do pet filtrado, para deixar claro de quem é o histórico exibido.
  const petName = petId ? (pets ?? []).find((p) => p.id === petId)?.name ?? null : null;

  type Row = (typeof rows)[number];
  const tutorFeedbackOf = (a: Row) =>
    ((a.feedback as unknown as {
      direction: string;
      rating: number | null;
      comment: string | null;
      responses: FeedbackResponse[] | null;
    }[]) ?? []).find((f) => f.direction === "TUTOR_TO_PETSHOP");

  const upcoming = rows
    .filter((a) => OPEN_STATUSES.includes(a.status as AppointmentStatus))
    .sort((x, y) => (x.scheduled_at ?? "").localeCompare(y.scheduled_at ?? ""));
  const past = rows.filter((a) => !OPEN_STATUSES.includes(a.status as AppointmentStatus));
  const toReview = past.filter((a) => a.status === "COMPLETED" && !tutorFeedbackOf(a)).length;

  // Histórico agrupado por mês, na ordem em que a consulta já vem (recentes primeiro).
  const months: { label: string; items: Row[] }[] = [];
  for (const a of past) {
    const when = a.finished_at ?? a.scheduled_at;
    const label = when ? monthLabel(when) : "Sem data";
    const group = months[months.length - 1];
    if (group && group.label === label) group.items.push(a);
    else months.push({ label, items: [a] });
  }

  // Chips de pet: trocam o filtro mantendo o período escolhido.
  const petHref = (id: string | null) => {
    const params = new URLSearchParams();
    if (id) params.set("pet", id);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    const qs = params.toString();
    return qs ? `/atendimentos?${qs}` : "/atendimentos";
  };

  function renderCard(a: Row) {
    const pet = a.pet as unknown as { name: string } | null;
    const service = a.service_type as unknown as { name: string } | null;
    const status = a.status as AppointmentStatus;
    const tutorFb = tutorFeedbackOf(a);
    // Boletim de comportamento do atendimento (uma linha por appointment).
    const reportRow = ((a.pet_behavior_report as unknown as {
      overall_score: number | string | null;
      responses: BehaviorResponse[] | null;
      note: string | null;
    }[]) ?? [])[0];
    const behavior = reportRow
      ? {
          // numeric volta como string no supabase-js.
          overallScore:
            reportRow.overall_score === null ? null : Number(reportRow.overall_score),
          responses: reportRow.responses ?? [],
          note: reportRow.note,
        }
      : null;
    const steps = ((a.appointment_step as unknown as {
      id: string;
      label: string;
      done_at: string | null;
      position: number;
    }[]) ?? [])
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((s) => ({ id: s.id, label: s.label, doneAtLabel: timeOf(s.done_at) }));
    // Serviços irmãos do mesmo pedido: desmarcar um costuma significar
    // desmarcar o pedido inteiro, então o card oferece as duas coisas.
    const siblings = a.request_group_id
      ? rows
          .filter(
            (o) =>
              o.id !== a.id &&
              o.request_group_id === a.request_group_id &&
              cancelable(o),
          )
          .map((o) => ({
            id: o.id,
            serviceName:
              (o.service_type as unknown as { name: string } | null)?.name ?? "Serviço",
          }))
      : [];
    const when = status === "COMPLETED" ? (a.finished_at ?? a.scheduled_at) : a.scheduled_at;

    return (
      <AppointmentHistoryCard
        key={a.id}
        appointmentId={a.id}
        petName={pet?.name ?? "Pet"}
        serviceName={service?.name ?? "Serviço"}
        status={status}
        dateLabel={weekdayAndTime(when)}
        dateIso={when}
        defaultOpen={a.id === abrir}
        canCancel={cancelable(a)}
        siblings={siblings}
        cancellation={
          status === "CANCELLED"
            ? {
                reason: a.cancellation_reason,
                byTutor: a.cancelled_by_role === "TUTOR",
                atLabel: a.cancelled_at ? dayAndTime(a.cancelled_at) : "—",
              }
            : null
        }
        steps={steps}
        behavior={behavior}
        photos={a.photos ?? []}
        feedbackFields={feedbackFields}
        tutorFb={
          tutorFb
            ? { rating: tutorFb.rating, comment: tutorFb.comment, responses: tutorFb.responses }
            : null
        }
      />
    );
  }

  // Sem nenhum atendimento e sem filtro, os filtros não têm o que filtrar.
  const showToolbar = rows.length > 0 || hasFilter;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Atendimentos</h1>
        <p className="text-sm text-gray-neutral">
          {petName
            ? `Os horários e o histórico de ${petName}: etapas, fotos, boletim e sua avaliação.`
            : "Os horários e o histórico dos seus pets: etapas, fotos, boletim e sua avaliação."}
        </p>
      </header>

      {erro && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-graphite">
          {CANCEL_ERRORS[erro] ?? CANCEL_ERRORS["1"]}
        </div>
      )}

      {cancelado && (
        <div className="rounded-2xl border border-graphite/10 bg-surface-muted p-4 text-sm text-graphite">
          Agendamento cancelado. O petshop já foi avisado.
        </div>
      )}

      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2">
          {(pets ?? []).length > 1 && (
            <>
              <Link
                href={petHref(null)}
                aria-current={!petId ? "page" : undefined}
                className={cn(
                  chip,
                  !petId
                    ? "border-orange bg-orange text-white"
                    : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
                )}
              >
                Todos os pets
              </Link>
              {(pets ?? []).map((p) => {
                const active = p.id === petId;
                return (
                  <Link
                    key={p.id}
                    href={petHref(p.id)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      chip,
                      active
                        ? "border-orange bg-orange text-white"
                        : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
                    )}
                  >
                    {p.photo_path && (
                      <Avatar name={p.name} src={p.photo_path} size="sm" className="h-5 w-5" />
                    )}
                    {p.name}
                  </Link>
                );
              })}
              <span className="mx-1 hidden h-5 w-px bg-graphite/10 sm:block" aria-hidden />
            </>
          )}
          <AppointmentsDateFilter from={fromDate} to={toDate} />
        </div>
      )}

      {rows.length === 0 ? (
        hasFilter ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhum atendimento encontrado"
            description="Nada com esses filtros. Tente outro período ou veja todos os pets."
            action={
              <Link
                href="/atendimentos"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-graphite/10 bg-surface-muted px-4 text-sm font-medium text-graphite transition-colors hover:bg-gray-soft"
              >
                Limpar filtros
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhum atendimento ainda"
            description="Cada banho e tosa fica guardado aqui: as etapas do dia, as fotos, o boletim de comportamento e a sua avaliação."
            action={
              <Link
                href="/agendar"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-orange/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
              >
                Agendar o primeiro
              </Link>
            }
          />
        )
      ) : (
        <>
          {toReview > 0 && (
            <p className="flex items-center gap-2 rounded-2xl bg-orange/[0.06] px-4 py-3 text-sm text-graphite">
              <Star className="h-4 w-4 shrink-0 text-orange" aria-hidden />
              {toReview === 1
                ? "1 atendimento espera sua avaliação. Abra o card marcado com “Avaliar”."
                : `${toReview} atendimentos esperam sua avaliação. Abra os cards marcados com “Avaliar”.`}
            </p>
          )}

          {upcoming.length > 0 && (
            <section>
              <h2 className="font-heading text-lg font-semibold text-graphite">Próximos</h2>
              <div className="mt-3 space-y-3">{upcoming.map(renderCard)}</div>
            </section>
          )}

          {months.map((group) => (
            <section key={group.label}>
              <h2 className="flex items-baseline gap-2 font-heading text-lg font-semibold text-graphite">
                {group.label}
                <span className="font-sans text-sm font-normal text-gray-neutral">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "atendimento" : "atendimentos"}
                </span>
              </h2>
              <div className="mt-3 space-y-3">{group.items.map(renderCard)}</div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
