"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, Badge, PhotoGallery, RatingStars } from "@mylivepet/ui";
import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@mylivepet/types";
import { TutorFeedbackForm } from "@/components/tutor-feedback-form";

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
export type HistoryFeedback = { rating: number | null; comment: string | null };

export function AppointmentHistoryCard({
  appointmentId,
  petName,
  serviceName,
  status,
  dateLabel,
  steps,
  behaviorComment,
  photos,
  tutorFb,
}: {
  appointmentId: string;
  petName: string;
  serviceName: string;
  status: AppointmentStatus;
  dateLabel: string;
  steps: HistoryStep[];
  behaviorComment: string | null;
  photos: string[];
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
          <Badge tone={tone[status]}>{APPOINTMENT_STATUS_LABEL[status]}</Badge>
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

          {behaviorComment && (
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="text-sm font-medium text-graphite">Comportamento do pet</p>
              <p className="text-sm text-gray-neutral">{behaviorComment}</p>
            </div>
          )}

          {completed && (
            <div className="border-t border-graphite/5 pt-3">
              {tutorFb ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-graphite">Sua avaliação</p>
                  {typeof tutorFb.rating === "number" && <RatingStars value={tutorFb.rating} />}
                  {tutorFb.comment && (
                    <p className="mt-1 text-sm text-gray-neutral">{tutorFb.comment}</p>
                  )}
                </div>
              ) : (
                <TutorFeedbackForm appointmentId={appointmentId} />
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
