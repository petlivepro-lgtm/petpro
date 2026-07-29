"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import {
  Button,
  Dialog,
  Label,
  PhotoGalleryInput,
  RatingStars,
  Select,
  StatusChip,
  Textarea,
  type ButtonProps,
} from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  computeOverallScore,
  formatBehaviorScore,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  type BehaviorCategory,
  type BehaviorResponse,
} from "@mylivepet/types";
import {
  finishAppointment,
  type FinishAppointmentState,
} from "@/app/(app)/atendimentos/[id]/actions";

export function FinishAppointmentDialog({
  appointmentId,
  behaviorCategories = [],
  size,
  className = "w-full",
}: {
  appointmentId: string;
  /** Categorias do boletim configuradas em /configuracoes. */
  behaviorCategories?: BehaviorCategory[];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState<
    FinishAppointmentState,
    FormData
  >(finishAppointment, { ok: false });

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    setScores({});
    router.refresh();
  }, [state.ok, router]);

  // Só as categorias efetivamente pontuadas viram resposta, com snapshot de
  // rótulo/inversão para o boletim seguir legível se a config mudar depois.
  const responses = useMemo<BehaviorResponse[]>(
    () =>
      behaviorCategories
        .filter((c) => typeof scores[c.id] === "number")
        .map((c) => ({
          category_id: c.id,
          label: c.label,
          inverted: c.inverted,
          value: scores[c.id],
        })),
    [behaviorCategories, scores],
  );

  const missingRequired = behaviorCategories.some(
    (c) => c.required && typeof scores[c.id] !== "number",
  );
  const overall = computeOverallScore(responses);
  // O selo real depende do histórico do pet; aqui é só a prévia deste boletim.
  const previewBadge = behaviorBadgeOf(overall, 3);

  return (
    <>
      <Button onClick={() => setOpen(true)} size={size} className={className}>
        <CheckCircle2 className="h-4 w-4" />{" "}
        {size === "sm" ? "Finalizar" : "Finalizar atendimento"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Finalizar atendimento"
        description="Confirme o pagamento e registre o boletim de comportamento do pet."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="appointment_id" value={appointmentId} />
          <input
            type="hidden"
            name="behavior_responses"
            value={JSON.stringify(responses)}
          />

          <div>
            <Label htmlFor={`appointment-payment-${appointmentId}`}>
              Forma de pagamento *
            </Label>
            <Select
              id={`appointment-payment-${appointmentId}`}
              name="payment_method"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Selecione
              </option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABEL[method]}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Fotos do pet (até 5)</Label>
            <PhotoGalleryInput name="photos" max={5} capture="environment" />
          </div>

          {behaviorCategories.length > 0 && (
            <div className="rounded-xl bg-surface-muted p-4">
              <p className="font-heading text-sm font-semibold text-graphite">
                Boletim de comportamento
              </p>
              <p className="mb-3 text-xs text-gray-neutral">
                Uma nota de 1 a 5 por categoria.
              </p>

              <div className="space-y-3">
                {behaviorCategories.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-sm text-graphite">
                      {c.label}
                      {c.required && <span className="text-orange"> *</span>}
                    </span>
                    <RatingStars
                      value={scores[c.id] ?? 0}
                      onChange={(v) =>
                        setScores((prev) => ({ ...prev, [c.id]: v }))
                      }
                    />
                  </div>
                ))}
              </div>

              {overall !== null && (
                <div className="mt-3 flex items-center gap-2 border-t border-graphite/5 pt-3">
                  <span className="text-sm text-gray-neutral">
                    Média deste atendimento:{" "}
                    <strong className="text-graphite">
                      {formatBehaviorScore(overall)}
                    </strong>
                  </span>
                  {previewBadge && (
                    <StatusChip tone={BEHAVIOR_BADGE_TONE[previewBadge]}>
                      {BEHAVIOR_BADGE_LABEL[previewBadge]}
                    </StatusChip>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <Label htmlFor="behavior_note">Observações</Label>
            <Textarea
              id="behavior_note"
              name="behavior_note"
              rows={3}
              placeholder="Ex.: comportou-se muito bem, ficou tranquilo no banho."
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || missingRequired}>
              {pending ? "Concluindo..." : "Concluir atendimento"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
