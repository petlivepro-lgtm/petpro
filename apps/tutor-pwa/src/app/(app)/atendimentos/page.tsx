import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { EmptyState } from "@mylivepet/ui";
import {
  feedbackConfigSchema,
  type AppointmentStatus,
  type FeedbackField,
  type FeedbackResponse,
} from "@mylivepet/types";
import { ClipboardList } from "lucide-react";
import { AppointmentHistoryCard } from "@/components/appointment-history-card";

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function HistoricoPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data } = await supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, finished_at, photos, pet:pet_id(name), service_type(name), feedback(direction, rating, comment, responses), appointment_step(id, label, done_at, position)",
    )
    .eq("tutor_id", ctx.tutorId)
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const rows = data ?? [];

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

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite">Atendimentos</h1>
        <p className="text-sm text-gray-neutral">Histórico dos serviços do seu pet.</p>
      </header>

      {rows.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nenhum atendimento ainda" />
      ) : (
        <div className="space-y-4">
          {rows.map((a) => {
            const pet = a.pet as unknown as { name: string } | null;
            const service = a.service_type as unknown as { name: string } | null;
            const status = a.status as AppointmentStatus;
            const fbs = (a.feedback as unknown as { direction: string; rating: number | null; comment: string | null; responses: FeedbackResponse[] | null }[]) ?? [];
            const behavior = fbs.find((f) => f.direction === "STAFF_TO_TUTOR");
            const tutorFb = fbs.find((f) => f.direction === "TUTOR_TO_PETSHOP");
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
                behaviorComment={behavior?.comment ?? null}
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
