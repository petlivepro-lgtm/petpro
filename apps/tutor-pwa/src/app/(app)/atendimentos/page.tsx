import { createClient } from "@/lib/supabase/server";
import { Card, Badge, PhotoGallery, RatingStars, EmptyState } from "@mylivepet/ui";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@mylivepet/types";
import { ClipboardList } from "lucide-react";
import { TutorFeedbackForm } from "@/components/tutor-feedback-form";

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const tone: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function HistoricoPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, finished_at, photos, pet:pet_id(name), service_type(name), feedback(direction, rating, comment), appointment_step(id, label, done_at, position)",
    )
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(50);

  const rows = data ?? [];

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
            const fbs = (a.feedback as unknown as { direction: string; rating: number | null; comment: string | null }[]) ?? [];
            const behavior = fbs.find((f) => f.direction === "STAFF_TO_TUTOR");
            const tutorFb = fbs.find((f) => f.direction === "TUTOR_TO_PETSHOP");
            const steps = ((a.appointment_step as unknown as { id: string; label: string; done_at: string | null; position: number }[]) ?? [])
              .slice()
              .sort((x, y) => x.position - y.position);
            const photos = a.photos ?? [];
            const completed = status === "COMPLETED";

            return (
              <Card key={a.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-heading font-semibold text-graphite">
                      {pet?.name ?? "Pet"} · {service?.name ?? "Serviço"}
                    </p>
                    <p className="text-xs text-gray-neutral">{fmt(a.finished_at ?? a.scheduled_at)}</p>
                  </div>
                  <Badge tone={tone[status]}>{APPOINTMENT_STATUS_LABEL[status]}</Badge>
                </div>

                {completed && photos.length > 0 && <PhotoGallery photos={photos} alt={pet?.name ?? "Pet"} />}

                {completed && steps.length > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-graphite">Passos do atendimento</p>
                    <ul className="space-y-1">
                      {steps.map((s) => (
                        <li key={s.id} className="flex items-center justify-between text-sm text-gray-neutral">
                          <span>• {s.label}</span>
                          <span className="text-xs">{fmt(s.done_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {behavior?.comment && (
                  <div className="rounded-xl bg-surface-muted p-3">
                    <p className="text-sm font-medium text-graphite">Comportamento do pet</p>
                    <p className="text-sm text-gray-neutral">{behavior.comment}</p>
                  </div>
                )}

                {completed && (
                  <div className="border-t border-graphite/5 pt-3">
                    {tutorFb ? (
                      <div>
                        <p className="mb-1 text-sm font-medium text-graphite">Sua avaliação</p>
                        {typeof tutorFb.rating === "number" && <RatingStars value={tutorFb.rating} />}
                        {tutorFb.comment && <p className="mt-1 text-sm text-gray-neutral">{tutorFb.comment}</p>}
                      </div>
                    ) : (
                      <TutorFeedbackForm appointmentId={a.id} />
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
