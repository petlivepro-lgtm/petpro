import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { EmptyState } from "@mylivepet/ui";
import {
  feedbackConfigSchema,
  type AppointmentStatus,
  type BehaviorResponse,
  type FeedbackField,
  type FeedbackResponse,
} from "@mylivepet/types";
import Link from "next/link";
import { ClipboardList, X } from "lucide-react";
import { AppointmentHistoryCard } from "@/components/appointment-history-card";
import { AppointmentsDateFilter } from "@/components/appointments-date-filter";

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const CANCEL_ERRORS: Record<string, string> = {
  motivo: "Escreva o motivo do cancelamento para o petshop.",
  cancelamento:
    "Não foi possível cancelar. O atendimento pode já ter começado — fale com o petshop.",
  "1": "Não foi possível cancelar. Tente novamente.",
};

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    pet?: string;
    erro?: string;
    cancelado?: string;
  }>;
}) {
  const { from, to, pet: petId, erro, cancelado } = await searchParams;
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

  const { data } = await query
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const rows = data ?? [];
  const hasFilter = Boolean(fromDate || toDate || petId);

  // Um agendamento só pode ser desmarcado pelo app antes de começar e antes do
  // horário chegar — a RPC cancel_appointment (0055) repete a regra no banco.
  const now = Date.now();
  const cancelable = (row: { status: string; scheduled_at: string | null }) =>
    (row.status === "REQUESTED" || row.status === "CONFIRMED") &&
    !!row.scheduled_at &&
    new Date(row.scheduled_at).getTime() > now;

  // Formulário de avaliação configurado pelo petshop (vazio → padrão no card).
  const { data: tenantRow } = await supabase
    .from("tenant")
    .select("settings")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  const fbConfig = feedbackConfigSchema.safeParse(
    (tenantRow?.settings as { feedback?: unknown } | null)?.feedback,
  );
  const feedbackFields: FeedbackField[] = fbConfig.success ? fbConfig.data.fields : [];

  // Nome do pet filtrado, para deixar claro de quem é o histórico exibido.
  const petName = petId
    ? (await supabase.from("pet").select("name").eq("id", petId).maybeSingle()).data?.name ?? null
    : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite">Atendimentos</h1>
        <p className="text-sm text-gray-neutral">
          {petName ? `Histórico dos serviços de ${petName}.` : "Histórico dos serviços do seu pet."}
        </p>
        {petId && (
          <Link
            href="/atendimentos"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-petrol hover:underline"
          >
            <X className="h-4 w-4" /> Ver de todos os pets
          </Link>
        )}
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

      <AppointmentsDateFilter from={fromDate} to={toDate} />

      {rows.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title={hasFilter ? "Nenhum atendimento encontrado" : "Nenhum atendimento ainda"}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => {
            const pet = a.pet as unknown as { name: string } | null;
            const service = a.service_type as unknown as { name: string } | null;
            const status = a.status as AppointmentStatus;
            const fbs = (a.feedback as unknown as { direction: string; rating: number | null; comment: string | null; responses: FeedbackResponse[] | null }[]) ?? [];
            const tutorFb = fbs.find((f) => f.direction === "TUTOR_TO_PETSHOP");
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
                    reportRow.overall_score === null
                      ? null
                      : Number(reportRow.overall_score),
                  responses: reportRow.responses ?? [],
                  note: reportRow.note,
                }
              : null;
            const steps = ((a.appointment_step as unknown as { id: string; label: string; done_at: string | null; position: number }[]) ?? [])
              .slice()
              .sort((x, y) => x.position - y.position)
              .map((s) => ({ id: s.id, label: s.label, doneAtLabel: fmt(s.done_at) }));
            const photos = a.photos ?? [];
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
                      (o.service_type as unknown as { name: string } | null)
                        ?.name ?? "Serviço",
                  }))
              : [];

            return (
              <AppointmentHistoryCard
                key={a.id}
                appointmentId={a.id}
                petName={pet?.name ?? "Pet"}
                serviceName={service?.name ?? "Serviço"}
                status={status}
                dateLabel={fmt(a.finished_at ?? a.scheduled_at)}
                canCancel={cancelable(a)}
                siblings={siblings}
                cancellation={
                  status === "CANCELLED"
                    ? {
                        reason: a.cancellation_reason,
                        byTutor: a.cancelled_by_role === "TUTOR",
                        atLabel: fmt(a.cancelled_at),
                      }
                    : null
                }
                steps={steps}
                behavior={behavior}
                photos={photos}
                feedbackFields={feedbackFields}
                tutorFb={
                  tutorFb
                    ? { rating: tutorFb.rating, comment: tutorFb.comment, responses: tutorFb.responses }
                    : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
