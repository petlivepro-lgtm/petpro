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

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; pet?: string }>;
}) {
  const { from, to, pet: petId } = await searchParams;
  const fromDate = from && ISO_DATE.test(from) ? from : undefined;
  const toDate = to && ISO_DATE.test(to) ? to : undefined;

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  let query = supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, finished_at, photos, pet:pet_id(name), service_type(name), feedback(direction, rating, comment, responses), pet_behavior_report(overall_score, responses, note), appointment_step(id, label, done_at, position)",
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

            return (
              <AppointmentHistoryCard
                key={a.id}
                appointmentId={a.id}
                petName={pet?.name ?? "Pet"}
                serviceName={service?.name ?? "Serviço"}
                status={status}
                dateLabel={fmt(a.finished_at ?? a.scheduled_at)}
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
