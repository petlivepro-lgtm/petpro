import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Play,
  Check,
  ListChecks,
  PawPrint,
  MessageSquare,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  PageHeader,
  Button,
  Avatar,
  Timeline,
  TimelineItem,
  PhotoGallery,
  RatingStars,
  Input,
  Label,
} from "@mylivepet/ui";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { FinishAppointmentDialog } from "@/components/finish-appointment-dialog";
import type { AppointmentStatus } from "@mylivepet/types";
import { startAppointment, addStep } from "./actions";

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function AtendimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: appt } = await supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, started_at, finished_at, notes, photos, pet:pet_id(id, name), tutor:tutor_id(full_name), service_type(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!appt) notFound();

  const pet = appt.pet as unknown as { id: string; name: string } | null;
  const tutor = appt.tutor as unknown as { full_name: string } | null;
  const service = appt.service_type as unknown as { name: string } | null;
  const status = appt.status as AppointmentStatus;

  const { data: steps } = await supabase
    .from("appointment_step")
    .select("id, label, done_at, position")
    .eq("appointment_id", id)
    .order("position", { ascending: true });

  const { data: feedbacks } = await supabase
    .from("feedback")
    .select("direction, rating, comment, created_at")
    .eq("appointment_id", id);

  const behavior = (feedbacks ?? []).find((f) => f.direction === "STAFF_TO_TUTOR");
  const tutorFb = (feedbacks ?? []).find((f) => f.direction === "TUTOR_TO_PETSHOP");

  const photos = appt.photos ?? [];

  // eventos da linha do tempo (ciclo + passos)
  type Ev = { key: string; title: string; time: string | null; icon: React.ReactNode; color: string };
  const events: Ev[] = [];
  events.push({ key: "ag", title: "Agendado", time: appt.scheduled_at, icon: <CalendarClock className="h-4 w-4" />, color: "#1D4E5F" });
  if (appt.started_at)
    events.push({ key: "ini", title: "Atendimento iniciado", time: appt.started_at, icon: <Play className="h-4 w-4" />, color: "#FF6A00" });
  (steps ?? []).forEach((s) =>
    events.push({ key: s.id, title: s.label, time: s.done_at, icon: <ListChecks className="h-4 w-4" />, color: "#1D6E84" }),
  );
  if (appt.finished_at)
    events.push({ key: "fim", title: "Atendimento finalizado", time: appt.finished_at, icon: <Check className="h-4 w-4" />, color: "#2E7D5B" });

  return (
    <div>
      <Link
        href="/atendimentos"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-neutral hover:text-graphite"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <PageHeader
        title={service?.name ?? "Atendimento"}
        subtitle={pet ? `${pet.name}${tutor ? ` · ${tutor.full_name}` : ""}` : undefined}
        actions={<AppointmentStatusBadge status={status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal: linha do tempo */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 font-heading text-lg font-semibold text-graphite">Histórico</h2>
            <Timeline>
              {events.map((e, i) => (
                <TimelineItem
                  key={e.key}
                  title={e.title}
                  time={fmt(e.time)}
                  icon={e.icon}
                  color={e.color}
                  last={i === events.length - 1}
                />
              ))}
            </Timeline>
          </Card>

          {photos.length > 0 && (
            <Card>
              <h2 className="mb-3 font-heading text-lg font-semibold text-graphite">Fotos do pet</h2>
              <PhotoGallery photos={photos} alt={pet?.name ?? "Pet"} />
            </Card>
          )}

          {behavior?.comment && (
            <Card>
              <div className="mb-2 flex items-center gap-2 text-graphite">
                <PawPrint className="h-4 w-4 text-orange" />
                <h2 className="font-heading text-lg font-semibold">Comportamento</h2>
              </div>
              <p className="text-sm text-gray-neutral">{behavior.comment}</p>
            </Card>
          )}

          {tutorFb && (
            <Card>
              <div className="mb-2 flex items-center gap-2 text-graphite">
                <Star className="h-4 w-4 text-orange" />
                <h2 className="font-heading text-lg font-semibold">Avaliação do tutor</h2>
              </div>
              {typeof tutorFb.rating === "number" && <RatingStars value={tutorFb.rating} />}
              {tutorFb.comment && <p className="mt-2 text-sm text-gray-neutral">{tutorFb.comment}</p>}
            </Card>
          )}
        </div>

        {/* Coluna lateral: ações */}
        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={pet?.name ?? "Pet"} size="sm" />
              <div className="min-w-0">
                {pet ? (
                  <Link href={`/pets/${pet.id}`} className="font-medium text-graphite hover:text-orange">
                    {pet.name}
                  </Link>
                ) : (
                  <p className="font-medium text-graphite">Pet</p>
                )}
                {tutor && <p className="text-xs text-gray-neutral">{tutor.full_name}</p>}
              </div>
            </div>

            {(status === "CONFIRMED" || status === "CHECKED_IN") && (
              <form action={startAppointment}>
                <input type="hidden" name="appointment_id" value={id} />
                <Button type="submit" className="w-full">
                  <Play className="h-4 w-4" /> Iniciar atendimento
                </Button>
              </form>
            )}

            {status === "IN_PROGRESS" && (
              <div className="space-y-4">
                <form action={addStep} className="space-y-2">
                  <input type="hidden" name="appointment_id" value={id} />
                  <Label htmlFor="label">Adicionar passo</Label>
                  <div className="flex gap-2">
                    <Input id="label" name="label" required placeholder="Ex.: Banho concluído" />
                    <Button type="submit" variant="secondary">
                      Add
                    </Button>
                  </div>
                </form>
                <FinishAppointmentDialog appointmentId={id} />
              </div>
            )}

            {status === "COMPLETED" && (
              <p className="flex items-center gap-2 text-sm text-success">
                <Check className="h-4 w-4" /> Atendimento finalizado
              </p>
            )}

            {(status === "REQUESTED" || status === "REJECTED" || status === "CANCELLED") && (
              <p className="text-sm text-gray-neutral">
                {status === "REQUESTED"
                  ? "Confirme esta solicitação em Solicitações para iniciar."
                  : "Atendimento não realizado."}
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
