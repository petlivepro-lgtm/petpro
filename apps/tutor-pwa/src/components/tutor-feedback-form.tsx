"use client";

import { useMemo, useState } from "react";
import { Button, RatingStars, ScaleSelector, Textarea } from "@mylivepet/ui";
import type { FeedbackField, FeedbackResponse } from "@mylivepet/types";
import { submitTutorFeedback } from "@/app/(app)/actions";

// Formulário padrão quando o petshop ainda não configurou nada.
const DEFAULT_FIELDS: FeedbackField[] = [
  { id: "default-rating", type: "STARS", label: "Sua avaliação", required: true },
  { id: "default-comment", type: "TEXT", label: "Comentário", required: false },
];

export function TutorFeedbackForm({
  appointmentId,
  fields,
}: {
  appointmentId: string;
  fields: FeedbackField[];
}) {
  const formFields = fields.length > 0 ? fields : DEFAULT_FIELDS;
  const [values, setValues] = useState<Record<string, number | string>>({});

  function set(id: string, value: number | string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  function isAnswered(f: FeedbackField) {
    const v = values[f.id];
    if (f.type === "TEXT") return typeof v === "string" && v.trim() !== "";
    return typeof v === "number";
  }

  // Só monta as respostas dos campos efetivamente preenchidos.
  const responses = useMemo<FeedbackResponse[]>(
    () =>
      formFields
        .filter(isAnswered)
        .map((f) => ({
          field_id: f.id,
          type: f.type,
          label: f.label,
          value: f.type === "TEXT" ? String(values[f.id]).trim() : (values[f.id] as number),
        })),
    [formFields, values],
  );

  const missingRequired = formFields.some((f) => f.required && !isAnswered(f));
  const canSubmit = responses.length > 0 && !missingRequired;

  return (
    <form action={submitTutorFeedback} className="space-y-4">
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <input type="hidden" name="responses" value={JSON.stringify(responses)} />

      {formFields.map((f) => (
        <div key={f.id}>
          <p className="mb-1.5 text-sm font-medium text-graphite">
            {f.label}
            {f.required && <span className="text-orange"> *</span>}
          </p>
          {f.type === "STARS" && (
            <RatingStars
              value={typeof values[f.id] === "number" ? (values[f.id] as number) : 0}
              onChange={(v) => set(f.id, v)}
            />
          )}
          {f.type === "SCALE_10" && (
            <ScaleSelector
              value={typeof values[f.id] === "number" ? (values[f.id] as number) : null}
              onChange={(v) => set(f.id, v)}
            />
          )}
          {f.type === "TEXT" && (
            <Textarea
              rows={2}
              value={typeof values[f.id] === "string" ? (values[f.id] as string) : ""}
              onChange={(e) => set(f.id, e.target.value)}
              placeholder={f.required ? "" : "Opcional."}
            />
          )}
        </div>
      ))}

      <Button type="submit" size="sm" disabled={!canSubmit}>
        Enviar avaliação
      </Button>
    </form>
  );
}
