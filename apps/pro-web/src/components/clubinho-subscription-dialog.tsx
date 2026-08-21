"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Pencil, Plus } from "lucide-react";
import {
  Button,
  Checkbox,
  CurrencyInput,
  DatePicker,
  Dialog,
  Input,
  Label,
  Select,
  type ButtonProps,
} from "@mylivepet/ui";
import {
  CLUBINHO_CYCLE_EVERY,
  clubinhoCycleLabel,
  formatBRL,
  type ClubinhoPlanDTO,
  type ClubinhoSubscriptionDTO,
  type PaymentTerminalDTO,
} from "@mylivepet/types";
import { PaymentFields } from "@/components/payment-fields";
import {
  createClubinhoSubscription,
  updateClubinhoSubscription,
  type FormState,
} from "@/app/(app)/clubinho/actions";

export type PetOption = {
  id: string;
  name: string;
  tutor_name: string;
};

/** Data de hoje em "YYYY-MM-DD", que é o formato do DatePicker. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function ClubinhoSubscriptionDialog({
  subscription,
  plans,
  pets,
  terminals,
  trigger = "button",
  size,
  presetPetId,
}: {
  /** Presente = edição; ausente = nova adesão. */
  subscription?: ClubinhoSubscriptionDTO;
  plans: ClubinhoPlanDTO[];
  /** Pets sem assinatura aberta. Ignorado na edição. */
  pets?: PetOption[];
  terminals: PaymentTerminalDTO[];
  trigger?: "button" | "icon" | "cta";
  size?: ButtonProps["size"];
  /** Pré-seleciona o pet (usado na ficha do pet). */
  presetPetId?: string;
}) {
  const router = useRouter();
  const isEdit = !!subscription;
  const [open, setOpen] = useState(false);
  const [planId, setPlanId] = useState(subscription?.plan_id ?? "");
  const [priceCents, setPriceCents] = useState(subscription?.price_cents ?? 0);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateClubinhoSubscription : createClubinhoSubscription,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  useEffect(() => {
    if (!open) return;
    setPlanId(subscription?.plan_id ?? "");
    setPriceCents(subscription?.price_cents ?? 0);
  }, [open, subscription]);

  const sellable = useMemo(
    () => plans.filter((p) => p.active || p.id === subscription?.plan_id),
    [plans, subscription],
  );
  const plan = sellable.find((p) => p.id === planId);

  /** Escolher o plano puxa o preço de tabela; o balcão ainda pode negociar. */
  function pickPlan(id: string) {
    setPlanId(id);
    const chosen = sellable.find((p) => p.id === id);
    if (chosen) setPriceCents(chosen.price_cents);
  }

  const availablePets = pets ?? [];

  return (
    <>
      {isEdit || trigger === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Editar assinatura"
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : trigger === "cta" ? (
        <Button onClick={() => setOpen(true)} size={size}>
          <Crown className="h-4 w-4" /> Colocar no Clubinho
        </Button>
      ) : (
        <Button size={size ?? "sm"} onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova assinatura
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar assinatura" : "Colocar um pet no Clubinho"}
        description={
          isEdit
            ? `${subscription!.pet_name} · ${subscription!.plan_name}`
            : "A assinatura é do pet: um tutor pode ter um cão no pacote e o outro fora."
        }
      >
        <form action={formAction} className="space-y-4">
          {isEdit ? (
            <>
              <input type="hidden" name="id" value={subscription!.id} />
              <input
                type="hidden"
                name="pet_id"
                value={subscription!.pet_id}
              />
            </>
          ) : null}

          {!isEdit && (
            <div>
              <Label htmlFor="sub-pet">Pet *</Label>
              <Select
                id="sub-pet"
                name="pet_id"
                required
                defaultValue={presetPetId ?? ""}
              >
                <option value="" disabled>
                  {availablePets.length > 0
                    ? "Escolha o pet"
                    : "Todos os pets já estão no Clubinho"}
                </option>
                {availablePets.map((pet) => (
                  <option key={pet.id} value={pet.id}>
                    {pet.name} · {pet.tutor_name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {!isEdit && (
            <div>
              <Label htmlFor="sub-plan">Plano *</Label>
              <Select
                id="sub-plan"
                name="plan_id"
                required
                value={planId}
                onChange={(e) => pickPlan(e.target.value)}
              >
                <option value="" disabled>
                  {sellable.length > 0
                    ? "Escolha o plano"
                    : "Nenhum plano disponível — crie um em Configurações"}
                </option>
                {sellable.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} · {formatBRL(option.price_cents)} por{" "}
                    {CLUBINHO_CYCLE_EVERY[option.cycle]}
                  </option>
                ))}
              </Select>
              {plan && (
                <p className="mt-1.5 text-xs text-gray-neutral">
                  {clubinhoCycleLabel(plan.cycle, plan.cycle_days)} ·{" "}
                  {plan.items
                    .map((i) => `${i.quantity}x ${i.service_name}`)
                    .join(", ")}
                  {plan.rollover && " · o que sobrar acumula"}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="sub-price">Valor cobrado *</Label>
              <CurrencyInput
                id="sub-price"
                name="price"
                required
                cents={priceCents}
                onCentsChange={(c) => setPriceCents(c ?? 0)}
              />
              {plan && priceCents !== plan.price_cents && (
                <p className="mt-1 text-xs text-warning">
                  Tabela: {formatBRL(plan.price_cents)}
                </p>
              )}
            </div>
            {!isEdit && (
              <div>
                <Label htmlFor="sub-start">Início *</Label>
                <DatePicker
                  id="sub-start"
                  name="started_on"
                  mode="date"
                  required
                  defaultValue={today()}
                />
              </div>
            )}
          </div>

          {/* A forma escolhida aqui é reaproveitada a cada renovação — é ela
              que lança a mensalidade no financeiro sem passar pelo balcão. */}
          <div className="rounded-xl bg-surface-muted p-4">
            <p className="mb-3 text-xs text-gray-neutral">
              Cobrança da mensalidade, repetida a cada renovação.
            </p>
            <PaymentFields
              idPrefix={`clubinho-${subscription?.id ?? "novo"}`}
              terminals={terminals}
              amountCents={priceCents}
            />
          </div>

          <Checkbox
            name="auto_renew"
            defaultChecked={subscription ? subscription.auto_renew : true}
            label={
              <span>
                Renovar automaticamente
                <span className="block text-xs text-gray-neutral">
                  Sem isso, a assinatura se encerra no fim do ciclo em vez de
                  cobrar de novo.
                </span>
              </span>
            }
          />

          <div>
            <Label htmlFor="sub-notes">Observações</Label>
            <Input
              id="sub-notes"
              name="notes"
              defaultValue={subscription?.notes ?? ""}
              placeholder="Opcional"
            />
          </div>

          {isEdit && (
            <p className="rounded-xl border border-graphite/10 bg-surface-muted p-3 text-xs text-gray-neutral">
              Mudanças valem da próxima renovação em diante. O saldo e a
              cobrança do ciclo em andamento continuam como foram vendidos.
            </p>
          )}

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                pending || (!isEdit && (sellable.length === 0 || !planId))
              }
            >
              {pending ? "Salvando..." : isEdit ? "Salvar" : "Assinar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
