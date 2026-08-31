"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { Button, ChoiceChips, Dialog, Label, Textarea } from "@mylivepet/ui";
import { cancelAppointment, type FormState } from "@/app/(app)/actions";

/** Serviço irmão do mesmo pedido (mesmo request_group_id e horário). */
export type CancelSibling = { id: string; serviceName: string };

/**
 * Cancela um agendamento já aceito, com motivo — o texto vai para o tutor no
 * app dele (0055) e o horário volta a ficar livre na agenda do profissional.
 *
 * Quando o pedido tem serviços irmãos no mesmo horário, o padrão é derrubar o
 * pedido inteiro: é o caso comum ("não vou levar o pet"). Quem quiser manter os
 * outros escolhe "só este serviço".
 */
export function CancelAppointmentDialog({
  appointmentId,
  serviceName,
  siblings = [],
  className,
}: {
  appointmentId: string;
  serviceName: string;
  siblings?: CancelSibling[];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<"all" | "one">("all");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelAppointment,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    setReason("");
    router.refresh();
  }, [state.ok, router]);

  const total = siblings.length + 1;
  const ids =
    siblings.length > 0 && scope === "all"
      ? [appointmentId, ...siblings.map((s) => s.id)]
      : [appointmentId];

  return (
    <>
      <Button
        variant="secondary"
        className={className}
        type="button"
        onClick={() => setOpen(true)}
      >
        <CalendarX2 className="h-4 w-4" /> Cancelar agendamento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar agendamento"
        description="O motivo aparece para o tutor no app dele e o horário volta a ficar livre na agenda."
      >
        <form action={formAction} className="space-y-4">
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
              placeholder="Ex.: a profissional precisou se ausentar; já ligamos para remarcar."
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? "Cancelando..." : "Cancelar agendamento"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
