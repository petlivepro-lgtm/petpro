"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Crown } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  Label,
  PhotoGalleryInput,
  RatingStars,
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
  type BehaviorCategory,
  type BehaviorResponse,
  type PaymentTerminalDTO,
} from "@mylivepet/types";
import {
  fetchClubinhoCoverage,
  finishAppointment,
  type ClubinhoCoverage,
  type FinishAppointmentState,
} from "@/app/(app)/atendimentos/[id]/actions";
import { PaymentFields } from "@/components/payment-fields";

export function FinishAppointmentDialog({
  appointmentId,
  behaviorCategories = [],
  terminals = [],
  priceCents,
  size,
  className = "w-full",
}: {
  appointmentId: string;
  /** Categorias do boletim configuradas em /configuracoes. */
  behaviorCategories?: BehaviorCategory[];
  /** Maquininhas ativas, para escolher onde a cobrança foi passada. */
  terminals?: PaymentTerminalDTO[];
  /** Preço do serviço, quando conhecido, para a prévia do líquido. */
  priceCents?: number;
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>({});
  // Saldo do Clubinho: consultado só ao abrir, porque a lista da agenda mostra
  // dezenas de atendimentos e só um é finalizado por vez.
  const [coverage, setCoverage] = useState<ClubinhoCoverage | null>(null);
  const [useClubinho, setUseClubinho] = useState(false);
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

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCoverage(null);
    setUseClubinho(false);
    fetchClubinhoCoverage(appointmentId)
      .then((found) => {
        if (!alive) return;
        setCoverage(found);
        // Vem marcado quando há saldo: se o pet assina o pacote, cobrar de
        // novo no balcão é o erro provável, não o contrário.
        setUseClubinho(!!found && found.quantityLeft > 0);
      })
      .catch(() => {
        // Falha aqui só significa "sem Clubinho nesta tela": o atendimento
        // segue finalizável pelo caminho normal.
      });
    return () => {
      alive = false;
    };
  }, [open, appointmentId]);

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

          {coverage && (
            <div className="rounded-xl border border-petrol/25 bg-petrol/5 p-4">
              <div className="flex gap-3">
                <Crown className="mt-0.5 h-5 w-5 shrink-0 text-petrol" />
                <div className="min-w-0 flex-1">
                  {coverage.quantityLeft > 0 ? (
                    <Checkbox
                      checked={useClubinho}
                      onChange={(e) => setUseClubinho(e.target.checked)}
                      label={
                        <span>
                          Descontar do {coverage.planName}
                          <span className="block text-xs text-gray-neutral">
                            Restam {coverage.quantityLeft} de{" "}
                            {coverage.quantityTotal} {coverage.serviceName} no
                            ciclo. Sem cobrança no balcão — a mensalidade já
                            entrou no financeiro.
                          </span>
                        </span>
                      }
                    />
                  ) : (
                    <p className="text-sm text-graphite">
                      O saldo de {coverage.serviceName} do {coverage.planName}{" "}
                      acabou neste ciclo.
                      <span className="block text-xs text-gray-neutral">
                        Este atendimento é cobrado à parte.
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {useClubinho && coverage ? (
            <input
              type="hidden"
              name="clubinho_credit_id"
              value={coverage.creditId}
            />
          ) : (
            <PaymentFields
              idPrefix={`appointment-${appointmentId}`}
              terminals={terminals}
              amountCents={priceCents}
            />
          )}

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
