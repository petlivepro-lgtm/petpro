"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, XCircle } from "lucide-react";
import { Button, Dialog, Input, Label } from "@mylivepet/ui";
import type { ClubinhoSubscriptionDTO } from "@mylivepet/types";
import {
  setClubinhoSubscriptionStatus,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/**
 * Pausar / retomar / cancelar a assinatura.
 *
 * Pausar e retomar não pedem confirmação — são reversíveis num clique. Cancelar
 * abre o diálogo porque libera a vaga do pet, apaga o selo do tutor e não tem
 * volta: recolocar o pet no Clubinho é uma assinatura nova, com ciclo novo e
 * mensalidade nova.
 */
export function ClubinhoStatusActions({
  subscription,
}: {
  subscription: ClubinhoSubscriptionDTO;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setClubinhoSubscriptionStatus,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setCancelling(false);
    router.refresh();
  }, [state.ok, router]);

  const paused = subscription.status === "PAUSED";

  return (
    <div className="flex items-center gap-1">
      <form action={formAction}>
        <input type="hidden" name="id" value={subscription.id} />
        <input type="hidden" name="pet_id" value={subscription.pet_id} />
        <input
          type="hidden"
          name="status"
          value={paused ? "ACTIVE" : "PAUSED"}
        />
        <button
          type="submit"
          disabled={pending}
          aria-label={paused ? "Retomar assinatura" : "Pausar assinatura"}
          title={
            paused
              ? "Retomar — volta a renovar no fim do ciclo"
              : "Pausar — congela o saldo e não renova"
          }
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange disabled:opacity-40"
        >
          {paused ? (
            <Play className="h-4 w-4" />
          ) : (
            <Pause className="h-4 w-4" />
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setCancelling(true)}
        aria-label="Cancelar assinatura"
        title="Cancelar assinatura"
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <XCircle className="h-4 w-4" />
      </button>

      <Dialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancelar assinatura?"
        description={`${subscription.pet_name} · ${subscription.plan_name}`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={subscription.id} />
          <input type="hidden" name="pet_id" value={subscription.pet_id} />
          <input type="hidden" name="status" value="CANCELLED" />

          <p className="text-sm text-graphite">
            O saldo que restava no ciclo é perdido e o pet sai do pacote. A
            mensalidade já lançada continua no financeiro — cancelar aqui não
            estorna nada.
          </p>
          <p className="text-sm text-gray-neutral">
            Se a intenção é só suspender por um tempo, use <strong>pausar</strong>
            : o saldo fica congelado e a vaga do pet é mantida.
          </p>

          <div>
            <Label htmlFor={`cancel-reason-${subscription.id}`}>Motivo</Label>
            <Input
              id={`cancel-reason-${subscription.id}`}
              name="cancellation_reason"
              placeholder="Opcional — fica no histórico"
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCancelling(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelando..." : "Cancelar assinatura"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
