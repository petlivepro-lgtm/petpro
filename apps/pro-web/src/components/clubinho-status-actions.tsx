"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw, XCircle } from "lucide-react";
import { Button, Dialog, Input, Label } from "@mylivepet/ui";
import {
  clubinhoCycleLabel,
  formatBRL,
  type ClubinhoSubscriptionDTO,
} from "@mylivepet/types";
import {
  renewClubinhoSubscription,
  setClubinhoSubscriptionStatus,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/** "YYYY-MM-DD" de hoje no fuso local. */
function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nextDayIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Pausar / retomar / renovar / cancelar a assinatura.
 *
 * Pausar e retomar não pedem confirmação — são reversíveis num clique. Cancelar
 * abre o diálogo porque libera a vaga do pet, apaga o selo do tutor e não tem
 * volta: recolocar o pet no Clubinho é uma assinatura nova, com ciclo novo e
 * mensalidade nova. Renovar também confirma, porque lança a mensalidade.
 */
export function ClubinhoStatusActions({
  subscription,
}: {
  subscription: ClubinhoSubscriptionDTO;
}) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    setClubinhoSubscriptionStatus,
    { ok: false },
  );
  const [renewState, renewAction, renewPending] = useActionState<
    FormState,
    FormData
  >(renewClubinhoSubscription, { ok: false });

  useEffect(() => {
    if (!state.ok) return;
    setCancelling(false);
    router.refresh();
  }, [state.ok, router]);

  useEffect(() => {
    if (!renewState.ok) return;
    setRenewing(false);
    router.refresh();
  }, [renewState, router]);

  const paused = subscription.status === "PAUSED";

  // Mesma regra da RPC (0068): vigente antecipa o próximo ciclo, vencido
  // recomeça hoje; com um ciclo futuro já pago, não oferece de novo.
  const today = todayIso();
  const alreadyRenewed = subscription.period_start > today;
  const canRenew =
    (subscription.status === "ACTIVE" || subscription.status === "EXPIRED") &&
    !alreadyRenewed;
  const expired = subscription.period_end < today;
  const renewStart = expired ? today : nextDayIso(subscription.period_end);
  const charges =
    subscription.price_cents > 0 && subscription.payment_method !== null;

  return (
    <div className="flex items-center gap-1">
      {canRenew && (
        <button
          type="button"
          onClick={() => setRenewing(true)}
          aria-label="Renovar assinatura"
          title={
            expired
              ? "Renovar — abre um ciclo novo a partir de hoje"
              : "Renovar — antecipa o próximo ciclo"
          }
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-petrol/10 hover:text-petrol"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}

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
        open={renewing}
        onOpenChange={setRenewing}
        title="Renovar assinatura?"
        description={`${subscription.pet_name} · ${subscription.plan_name}`}
      >
        <form action={renewAction} className="space-y-4">
          <input type="hidden" name="id" value={subscription.id} />
          <input type="hidden" name="pet_id" value={subscription.pet_id} />

          <p className="text-sm text-graphite">
            {expired ? (
              <>
                O ciclo venceu em{" "}
                <strong>{longDate(subscription.period_end)}</strong>. Um ciclo
                novo ({clubinhoCycleLabel(
                  subscription.plan_cycle,
                  subscription.plan_cycle_days,
                )}
                ) começa <strong>hoje</strong>, com o saldo do plano cheio.
              </>
            ) : (
              <>
                O ciclo atual vai até{" "}
                <strong>{longDate(subscription.period_end)}</strong> e continua
                valendo. O próximo ciclo (
                {clubinhoCycleLabel(
                  subscription.plan_cycle,
                  subscription.plan_cycle_days,
                )}
                ) fica pago desde já e começa em{" "}
                <strong>{longDate(renewStart)}</strong>.
              </>
            )}
          </p>
          <p className="text-sm text-gray-neutral">
            {charges
              ? `A mensalidade de ${formatBRL(subscription.price_cents)} é lançada hoje no financeiro.`
              : "Sem forma de pagamento ou valor na assinatura — nada é lançado no financeiro."}
            {subscription.plan_rollover
              ? expired
                ? " O que sobrou do ciclo anterior acumula no novo."
                : " O que sobrar do ciclo atual passa para o próximo."
              : !expired && " O que sobrar do ciclo atual não acumula."}
          </p>

          {renewState.error && (
            <p className="text-sm text-danger">{renewState.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setRenewing(false)}
            >
              Voltar
            </Button>
            <Button type="submit" disabled={renewPending}>
              {renewPending ? "Renovando..." : "Renovar"}
            </Button>
          </div>
        </form>
      </Dialog>

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
