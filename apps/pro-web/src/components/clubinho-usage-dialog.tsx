"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig } from "lucide-react";
import { Button, DatePicker, Dialog, Input, Label, Select } from "@mylivepet/ui";
import type { ClubinhoSubscriptionDTO } from "@mylivepet/types";
import {
  registerClubinhoUsage,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/** "2025-08-28T14:00" — agora, no fuso de quem está no balcão. */
function localNow(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

/**
 * Marca um serviço do pacote como já realizado.
 *
 * Existe para o pet que já era do Clubinho antes de entrar no sistema: a
 * assinatura é criada hoje com o ciclo cheio, e os banhos que o tutor já
 * tomou precisam sair do saldo. Serve também para o que foi entregue no
 * balcão sem virar atendimento.
 *
 * A data vai para o servidor como ISO completo, montado aqui: o DatePicker
 * devolve hora local ("14:00"), e é só neste navegador que se sabe de que
 * fuso esse horário é.
 */
export function ClubinhoUsageDialog({
  subscription,
}: {
  subscription: ClubinhoSubscriptionDTO;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creditId, setCreditId] = useState("");
  const [when, setWhen] = useState("");

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    registerClubinhoUsage,
    { ok: false },
  );

  // Sem saldo não há o que dar baixa: o crédito do ciclo já foi todo entregue.
  const available = subscription.credits.filter((c) => c.quantity_left > 0);
  const exhausted = available.length === 0;
  const onlyCredit = available.length === 1 ? available[0]!.credit_id : "";

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  // O valor inicial só nasce ao abrir: calculado na renderização, a hora do
  // servidor e a do navegador não bateriam e a hidratação quebraria.
  useEffect(() => {
    if (!open) return;
    setWhen(localNow());
    setCreditId(onlyCredit);
  }, [open, onlyCredit]);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={exhausted}
        title={
          exhausted
            ? "O saldo deste ciclo já foi todo entregue"
            : "Descontar do saldo um serviço entregue fora do sistema"
        }
        onClick={() => setOpen(true)}
      >
        <CircleCheckBig className="h-4 w-4" /> Marcar realizado
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Marcar serviço como realizado"
        description={`${subscription.pet_name} · ${subscription.plan_name}`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="pet_id" value={subscription.pet_id} />
          <input
            type="hidden"
            name="used_at"
            value={when ? new Date(when).toISOString() : ""}
          />

          <p className="text-sm text-graphite">
            Desconta um serviço do saldo deste ciclo sem criar atendimento —
            para o que já foi entregue fora do sistema.
          </p>

          <div>
            <Label htmlFor={`usage-service-${subscription.id}`}>Serviço *</Label>
            <Select
              id={`usage-service-${subscription.id}`}
              name="credit_id"
              required
              value={creditId}
              onChange={(e) => setCreditId(e.target.value)}
            >
              <option value="" disabled>
                Escolha o serviço do pacote
              </option>
              {available.map((credit) => (
                <option key={credit.credit_id} value={credit.credit_id}>
                  {credit.service_name} · {credit.quantity_left} restante
                  {credit.quantity_left === 1 ? "" : "s"}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor={`usage-when-${subscription.id}`}>
              Quando foi realizado *
            </Label>
            {/* Sem `name`: o valor vai no hidden acima, já em ISO com fuso. */}
            <DatePicker
              id={`usage-when-${subscription.id}`}
              mode="datetime"
              value={when}
              onChange={setWhen}
              max="today"
            />
          </div>

          <div>
            <Label htmlFor={`usage-note-${subscription.id}`}>Observação</Label>
            <Input
              id={`usage-note-${subscription.id}`}
              name="note"
              maxLength={500}
              placeholder="Opcional — ex.: já era do Clubinho antes do sistema"
            />
          </div>

          <p className="rounded-xl bg-surface-muted p-3 text-xs text-gray-neutral">
            Não entra na agenda nem no financeiro: a mensalidade já pagou este
            serviço. Fica registrado como entrega do pacote, com a data e quem
            marcou.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !creditId || !when}>
              {pending ? "Marcando..." : "Marcar como realizado"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
