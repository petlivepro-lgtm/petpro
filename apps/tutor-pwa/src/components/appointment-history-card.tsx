"use client";

import { useState } from "react";
import { CalendarX2, ChevronDown } from "lucide-react";
import {
  Card,
  Badge,
  Button,
  ChoiceChips,
  Dialog,
  Label,
  PhotoGallery,
  RatingStars,
  ScaleSelector,
  Textarea,
} from "@mylivepet/ui";
import {
  formatBehaviorScore,
  type AppointmentStatus,
  type BehaviorResponse,
  type FeedbackField,
  type FeedbackResponse,
} from "@mylivepet/types";
import { TutorFeedbackForm } from "@/components/tutor-feedback-form";
import { cancelBooking } from "@/app/(app)/actions";
import { TUTOR_APPOINTMENT_STATUS_LABEL } from "@/lib/status-labels";

const tone: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export type HistoryStep = { id: string; label: string; doneAtLabel: string };
/** Serviço irmão do mesmo pedido, oferecido junto no cancelamento. */
export type HistorySibling = { id: string; serviceName: string };
export type HistoryCancellation = {
  reason: string | null;
  byTutor: boolean;
  atLabel: string;
};
export type HistoryFeedback = {
  rating: number | null;
  comment: string | null;
  responses: FeedbackResponse[] | null;
};
/** Boletim de comportamento registrado pelo petshop neste atendimento. */
export type HistoryBehavior = {
  overallScore: number | null;
  responses: BehaviorResponse[];
  note: string | null;
};

export function AppointmentHistoryCard({
  appointmentId,
  petName,
  serviceName,
  status,
  dateLabel,
  steps,
  behavior,
  photos,
  feedbackFields,
  tutorFb,
  canCancel = false,
  siblings = [],
  cancellation = null,
}: {
  appointmentId: string;
  petName: string;
  serviceName: string;
  status: AppointmentStatus;
  dateLabel: string;
  steps: HistoryStep[];
  behavior: HistoryBehavior | null;
  photos: string[];
  feedbackFields: FeedbackField[];
  tutorFb: HistoryFeedback | null;
  /** Ainda dá para desmarcar pelo app (antes de começar e antes do horário). */
  canCancel?: boolean;
  siblings?: HistorySibling[];
  /** Preenchido quando o atendimento está cancelado. */
  cancellation?: HistoryCancellation | null;
}) {
  const [open, setOpen] = useState(false);
  const completed = status === "COMPLETED";
  const needsReview = completed && !tutorFb;

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate font-heading font-semibold text-graphite">
            {petName} · {serviceName}
          </p>
          <p className="text-xs text-gray-neutral">{dateLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {needsReview && (
            <span className="inline-flex items-center rounded-full bg-orange/10 px-2.5 py-0.5 text-xs font-medium text-orange">
              Avaliar
            </span>
          )}
          <Badge tone={tone[status]}>{TUTOR_APPOINTMENT_STATUS_LABEL[status]}</Badge>
          <ChevronDown
            className={`h-5 w-5 text-gray-neutral transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </div>
      </button>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          {completed && photos.length > 0 && <PhotoGallery photos={photos} alt={petName} />}

          {completed && steps.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-graphite">Passos do atendimento</p>
              <ul className="space-y-1">
                {steps.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between text-sm text-gray-neutral"
                  >
                    <span>• {s.label}</span>
                    <span className="text-xs">{s.doneAtLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {behavior && (
            <div className="space-y-2 rounded-xl bg-surface-muted p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-graphite">
                  Boletim de comportamento
                </p>
                {behavior.overallScore !== null && (
                  <span className="flex items-center gap-1.5 text-xs text-gray-neutral">
                    <RatingStars
                      value={Math.round(behavior.overallScore)}
                      size="sm"
                    />
                    {formatBehaviorScore(behavior.overallScore)}
                  </span>
                )}
              </div>

              {behavior.responses.length > 0 && (
                <div className="space-y-1">
                  {behavior.responses.map((r) => (
                    <div
                      key={r.category_id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="text-sm text-gray-neutral">{r.label}</span>
                      <RatingStars value={r.value} size="sm" />
                    </div>
                  ))}
                </div>
              )}

              {behavior.note && (
                <p className="text-sm text-gray-neutral">{behavior.note}</p>
              )}
            </div>
          )}

          {cancellation && (
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="text-sm font-medium text-graphite">
                {cancellation.byTutor
                  ? "Você cancelou este agendamento"
                  : "O petshop cancelou este agendamento"}
                {cancellation.atLabel !== "—" ? ` em ${cancellation.atLabel}` : ""}
              </p>
              <p className="text-sm text-gray-neutral">
                {cancellation.reason ?? "Sem motivo registrado."}
              </p>
            </div>
          )}

          {canCancel && (
            <CancelBookingButton
              appointmentId={appointmentId}
              serviceName={serviceName}
              siblings={siblings}
            />
          )}

          {completed && (
            <div className="border-t border-graphite/5 pt-3">
              {tutorFb ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-graphite">Sua avaliação</p>
                  <FeedbackResponsesView fb={tutorFb} />
                </div>
              ) : (
                <TutorFeedbackForm appointmentId={appointmentId} fields={feedbackFields} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Desmarca o agendamento informando o motivo — o petshop recebe o aviso e o
 * horário volta a ficar livre. Quando o pedido tem mais de um serviço no mesmo
 * horário, o padrão é desmarcar tudo.
 */
function CancelBookingButton({
  appointmentId,
  serviceName,
  siblings,
}: {
  appointmentId: string;
  serviceName: string;
  siblings: HistorySibling[];
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"all" | "one">("all");

  const total = siblings.length + 1;
  const ids =
    siblings.length > 0 && scope === "all"
      ? [appointmentId, ...siblings.map((s) => s.id)]
      : [appointmentId];

  return (
    <>
      <Button
        variant="secondary"
        type="button"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <CalendarX2 className="h-4 w-4" /> Cancelar agendamento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar agendamento"
        description="O petshop é avisado com o motivo e o horário fica livre para outra pessoa."
      >
        <form action={cancelBooking} className="space-y-4">
          {ids.map((id) => (
            <input key={id} type="hidden" name="appointment_ids" value={id} />
          ))}

          {siblings.length > 0 && (
            <div>
              <Label>Este pedido tem {total} serviços no mesmo horário</Label>
              <ChoiceChips
                aria-label="O que cancelar"
                allowEmpty={false}
                value={scope}
                onChange={(v) => setScope(v === "one" ? "one" : "all")}
                options={[
                  { value: "all", label: `Cancelar os ${total} serviços` },
                  { value: "one", label: `Cancelar só ${serviceName}` },
                ]}
              />
            </div>
          )}

          <div>
            <Label htmlFor={`cancel-reason-${appointmentId}`}>
              Motivo do cancelamento *
            </Label>
            <Textarea
              id={`cancel-reason-${appointmentId}`}
              name="reason"
              required
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: vou viajar nesse dia."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Voltar
            </Button>
            <Button type="submit" variant="danger" disabled={reason.trim().length < 3}>
              Cancelar agendamento
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Exibe as respostas do tutor (modo leitura). Faz fallback para o formato
 * legado (rating + comment) quando não há `responses` estruturadas. */
function FeedbackResponsesView({ fb }: { fb: HistoryFeedback }) {
  const responses = fb.responses ?? [];
  if (responses.length === 0) {
    return (
      <div>
        {typeof fb.rating === "number" && <RatingStars value={fb.rating} />}
        {fb.comment && <p className="mt-1 text-sm text-gray-neutral">{fb.comment}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {responses.map((r, i) => (
        <div key={`${r.field_id}-${i}`}>
          <p className="mb-1 text-sm text-graphite">{r.label}</p>
          {r.type === "STARS" && typeof r.value === "number" && <RatingStars value={r.value} />}
          {r.type === "SCALE_10" && typeof r.value === "number" && <ScaleSelector value={r.value} />}
          {r.type === "TEXT" && <p className="text-sm text-gray-neutral">{String(r.value)}</p>}
        </div>
      ))}
    </div>
  );
}
