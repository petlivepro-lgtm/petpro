"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  CurrencyInput,
  Dialog,
  Input,
  Label,
  Select,
} from "@mylivepet/ui";
import {
  CLUBINHO_CYCLES,
  CLUBINHO_CYCLE_LABEL,
  formatBRL,
  type ClubinhoCycle,
  type ClubinhoPlanDTO,
} from "@mylivepet/types";
import { saveClubinhoPlan, type FormState } from "./actions";

export type ServiceOption = {
  id: string;
  name: string;
  price_cents: number;
};

type Item = { service_type_id: string; quantity: number };

/**
 * Atalhos para os dois pacotes que praticamente todo petshop vende. Preenchem
 * o formulário e nada mais — nome, valor e serviços continuam editáveis, e o
 * petshop que vende outra coisa simplesmente ignora os botões.
 */
const PRESETS: {
  label: string;
  hint: string;
  name: string;
  cycle: ClubinhoCycle;
  quantity: number;
}[] = [
  {
    label: "Mensal · 4 banhos",
    hint: "um por semana",
    name: "Clubinho Mensal",
    cycle: "MONTHLY",
    quantity: 4,
  },
  {
    label: "Quinzenal · 2 banhos",
    hint: "um a cada 15 dias",
    name: "Clubinho Quinzenal",
    cycle: "MONTHLY",
    quantity: 2,
  },
];

export function PlanDialog({
  plan,
  services,
}: {
  plan?: ClubinhoPlanDTO;
  services: ServiceOption[];
}) {
  const router = useRouter();
  const isEdit = !!plan;
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [cycle, setCycle] = useState<ClubinhoCycle>(plan?.cycle ?? "MONTHLY");
  // Nome e preço saem do estado (e não de defaultValue) porque os atalhos
  // precisam escrever neles depois que o diálogo já está aberto.
  const [name, setName] = useState(plan?.name ?? "");
  const [priceCents, setPriceCents] = useState(plan?.price_cents ?? 0);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveClubinhoPlan,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  // Reabrir o diálogo volta ao que está gravado, descartando rascunho.
  useEffect(() => {
    if (!open) return;
    setItems(
      (plan?.items ?? []).map((i) => ({
        service_type_id: i.service_type_id,
        quantity: i.quantity,
      })),
    );
    setCycle(plan?.cycle ?? "MONTHLY");
    setName(plan?.name ?? "");
    setPriceCents(plan?.price_cents ?? 0);
  }, [open, plan]);

  const byId = useMemo(
    () => new Map(services.map((s) => [s.id, s] as const)),
    [services],
  );
  const available = useMemo(
    () => services.filter((s) => !items.some((i) => i.service_type_id === s.id)),
    [services, items],
  );

  // Quanto os serviços do pacote custariam avulsos — é a conta que o balcão
  // faz para explicar o desconto ao tutor.
  const listPriceCents = items.reduce(
    (sum, item) => sum + (byId.get(item.service_type_id)?.price_cents ?? 0) * item.quantity,
    0,
  );
  const savingCents = listPriceCents - priceCents;

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setName(preset.name);
    setCycle(preset.cycle);
    // O atalho define a quantidade; o serviço é escolha do petshop, então só
    // preenche sozinho quando não há dúvida (um serviço no catálogo) ou
    // quando algo já foi escolhido.
    setItems((prev) => {
      if (prev.length > 0)
        return prev.map((i) => ({ ...i, quantity: preset.quantity }));
      const first = services[0];
      return first
        ? [{ service_type_id: first.id, quantity: preset.quantity }]
        : [];
    });
  }

  function setQuantity(serviceId: string, delta: number) {
    setItems((prev) =>
      prev.map((i) =>
        i.service_type_id === serviceId
          ? { ...i, quantity: Math.min(99, Math.max(1, i.quantity + delta)) }
          : i,
      ),
    );
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${plan!.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo plano
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar plano" : "Novo plano do Clubinho"}
        description="Quanto custa, de quanto em quanto tempo renova e quantos serviços entrega em cada ciclo."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={plan!.id} />}
          <input type="hidden" name="items" value={JSON.stringify(items)} />

          {!isEdit && (
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="mb-2 text-xs font-medium text-gray-neutral">
                Começar de um modelo
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="rounded-full border border-graphite/15 px-3 py-1.5 text-xs text-graphite transition-colors hover:border-orange/50 hover:bg-orange/5"
                  >
                    {preset.label}{" "}
                    <span className="text-gray-neutral">· {preset.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="plan-name">Nome do plano *</Label>
            <Input
              id="plan-name"
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Clubinho Mensal"
            />
          </div>

          <div>
            <Label htmlFor="plan-description">Descrição</Label>
            <Input
              id="plan-description"
              name="description"
              defaultValue={plan?.description ?? ""}
              placeholder="Como o plano é vendido ao tutor"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="plan-price">Valor por ciclo *</Label>
              <CurrencyInput
                id="plan-price"
                name="price"
                required
                cents={priceCents}
                onCentsChange={(c) => setPriceCents(c ?? 0)}
              />
            </div>
            <div>
              <Label htmlFor="plan-cycle">Renovação *</Label>
              <Select
                id="plan-cycle"
                name="cycle"
                required
                value={cycle}
                onChange={(e) => setCycle(e.target.value as ClubinhoCycle)}
              >
                {CLUBINHO_CYCLES.map((option) => (
                  <option key={option} value={option}>
                    {CLUBINHO_CYCLE_LABEL[option]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {cycle === "CUSTOM" && (
            <div>
              <Label htmlFor="plan-cycle-days">Renova a cada (dias) *</Label>
              <Input
                id="plan-cycle-days"
                name="cycle_days"
                type="number"
                min="1"
                max="365"
                required
                defaultValue={plan?.cycle_days ? String(plan.cycle_days) : "30"}
              />
            </div>
          )}

          <div>
            <Label>Serviços do pacote *</Label>
            <p className="mb-2 text-xs text-gray-neutral">
              Quantos atendimentos de cada serviço o pet tem direito em cada
              ciclo. O plano quinzenal costuma ser um mensal com 2 banhos.
            </p>

            {items.length > 0 && (
              <ul className="space-y-2">
                {items.map((item) => {
                  const service = byId.get(item.service_type_id);
                  return (
                    <li
                      key={item.service_type_id}
                      className="flex items-center gap-2 rounded-xl border border-graphite/10 px-3 py-2"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-graphite">
                        {service?.name ?? "Serviço removido"}
                        {service && (
                          <span className="block text-xs text-gray-neutral">
                            {formatBRL(service.price_cents)} avulso
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Diminuir"
                          onClick={() => setQuantity(item.service_type_id, -1)}
                          disabled={item.quantity <= 1}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums text-graphite">
                          {item.quantity}x
                        </span>
                        <button
                          type="button"
                          aria-label="Aumentar"
                          onClick={() => setQuantity(item.service_type_id, 1)}
                          disabled={item.quantity >= 99}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remover ${service?.name ?? "serviço"}`}
                        onClick={() =>
                          setItems((prev) =>
                            prev.filter(
                              (i) => i.service_type_id !== item.service_type_id,
                            ),
                          )
                        }
                        className="shrink-0 rounded-lg p-1.5 text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <Select
              aria-label="Adicionar serviço ao plano"
              className="mt-2"
              value=""
              disabled={available.length === 0}
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                setItems((prev) => [
                  ...prev,
                  { service_type_id: id, quantity: 1 },
                ]);
              }}
            >
              <option value="" disabled>
                {services.length === 0
                  ? "Cadastre um serviço antes de montar o plano"
                  : available.length > 0
                    ? "Adicionar serviço..."
                    : "Todos os serviços já estão no plano"}
              </option>
              {available.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>

            {items.length > 0 && listPriceCents > 0 && (
              <p className="mt-2 text-xs text-gray-neutral">
                Avulso sairia {formatBRL(listPriceCents)} por ciclo.{" "}
                {savingCents > 0 ? (
                  <span className="text-success">
                    O tutor economiza {formatBRL(savingCents)}.
                  </span>
                ) : savingCents < 0 ? (
                  <span className="text-warning">
                    O plano está {formatBRL(-savingCents)} mais caro que o
                    avulso.
                  </span>
                ) : null}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl bg-surface-muted p-4">
            <Checkbox
              name="rollover"
              defaultChecked={plan?.rollover ?? false}
              label={
                <span>
                  Acumular o que sobrar
                  <span className="block text-xs text-gray-neutral">
                    Banho não usado entra no ciclo seguinte. Sem isso, o saldo
                    zera na renovação.
                  </span>
                </span>
              }
            />
            <Checkbox
              name="active"
              defaultChecked={plan ? plan.active : true}
              label={
                <span>
                  Disponível para novas adesões
                  <span className="block text-xs text-gray-neutral">
                    Desativar não mexe em quem já assina.
                  </span>
                </span>
              }
            />
          </div>

          {isEdit && plan!.subscriber_count > 0 && (
            <p className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs text-graphite">
              {plan!.subscriber_count} pet
              {plan!.subscriber_count > 1 ? "s assinam" : " assina"} este plano.
              A mudança vale a partir da próxima renovação — o saldo do ciclo em
              andamento continua como foi vendido.
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
            <Button type="submit" disabled={pending || items.length === 0}>
              {pending ? "Salvando..." : "Salvar plano"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
