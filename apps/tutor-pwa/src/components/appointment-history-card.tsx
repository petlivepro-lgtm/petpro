"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, Badge, PhotoGallery, RatingStars, ScaleSelector } from "@mylivepet/ui";
import {
  formatBehaviorScore,
  type AppointmentStatus,
  type BehaviorResponse,
  type FeedbackField,
  type FeedbackResponse,
} from "@mylivepet/types";
import { TutorFeedbackForm } from "@/components/tutor-feedback-form";
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
