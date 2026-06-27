"use client";

import { useState } from "react";
import { Button, RatingStars } from "@mylivepet/ui";
import { submitTutorFeedback } from "@/app/(app)/actions";

export function TutorFeedbackForm({ appointmentId }: { appointmentId: string }) {
  const [rating, setRating] = useState(0);

  return (
    <form action={submitTutorFeedback} className="space-y-3">
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <p className="mb-1.5 text-sm font-medium text-graphite">Sua avaliação</p>
        <RatingStars value={rating} onChange={setRating} />
      </div>

      <textarea
        name="comment"
        rows={2}
        className="w-full rounded-xl border border-graphite/15 bg-surface p-3 text-sm text-graphite placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
        placeholder="Conte como foi a experiência (opcional)."
      />

      <Button type="submit" size="sm" disabled={rating === 0}>
        Enviar avaliação
      </Button>
    </form>
  );
}
