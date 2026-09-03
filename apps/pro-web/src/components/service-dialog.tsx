"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  ColorSwatchInput,
  CurrencyInput,
  Dialog,
  Input,
  Label,
  Select,
} from "@mylivepet/ui";
import type { ServiceStepTemplate, SizePrices } from "@mylivepet/types";
import {
  createServiceType,
  updateServiceType,
  type FormState,
} from "@/app/(app)/servicos/actions";
import { SizePriceFields } from "@/components/size-price-fields";
import { AGENDA_COLORS, colorNameOf } from "@/lib/agenda-colors";
import { useOpenFromUrl } from "@/lib/use-open-from-url";

export type ServiceRow = SizePrices & {
  id: string;
  name: string;
  description: string | null;
  /** Preço base: vale para porte sem preço próprio e para pet sem porte. */
  price_cents: number;
  duration_min: number;
  active: boolean;
  /** Cor do serviço na agenda, em "#RRGGBB"; nula = derivada do id. */
  color_hex: string | null;
  /** Etapas escolhidas na biblioteca do petshop (Configurações → Etapas). */
  step_ids: string[];
};

export function ServiceDialog({
  service,
  library,
}: {
  service?: ServiceRow;
  library: ServiceStepTemplate[];
}) {
  const router = useRouter();
  const isEdit = !!service;
  const [open, setOpen] = useState(false);

  // Só o gatilho de cadastro responde à paleta; com serviço é edição.
  useOpenFromUrl("servico", () => setOpen(true), !service);
  const [stepIds, setStepIds] = useState<string[]>(service?.step_ids ?? []);
  // O hex é a fonte da verdade, não o nome da paleta: com o seletor livre
  // existe cor sem nome nenhum. O nome é derivado só para acender o swatch
  // certo — fora da paleta ele vem nulo, que é o sinal de "é uma cor livre".
  const [colorHex, setColorHex] = useState<string | null>(
    service?.color_hex ?? null,
  );
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateServiceType : createServiceType,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  // Sincroniza os passos e a cor com o serviço sempre que o diálogo é aberto.
  useEffect(() => {
    if (!open) return;
    setStepIds(service?.step_ids ?? []);
    setColorHex(service?.color_hex ?? null);
  }, [open, service]);

  const colorName = useMemo(() => colorNameOf(colorHex), [colorHex]);

  const byId = useMemo(
    () => new Map(library.map((s) => [s.id, s] as const)),
    [library],
  );
  // Um id que sumiu da biblioteca (removida em outra aba) é descartado aqui.
  const selected = useMemo(
    () => stepIds.map((id) => byId.get(id)).filter((s): s is ServiceStepTemplate => !!s),
    [stepIds, byId],
  );
  const available = useMemo(
    () => library.filter((s) => !stepIds.includes(s.id)),
    [library, stepIds],
  );

  function moveStep(index: number, dir: -1 | 1) {
    setStepIds((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${service!.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo serviço
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar serviço" : "Novo serviço"}
        description="Disponível para agendamento no MyLivePet."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={service!.id} />}

          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required defaultValue={service?.name} placeholder="Ex.: Banho completo" />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              defaultValue={service?.description ?? ""}
              placeholder="Opcional"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="price">Preço base *</Label>
              <CurrencyInput id="price" name="price" required defaultCents={service?.price_cents} />
            </div>
            <div>
              <Label htmlFor="duration_min">Duração (min) *</Label>
              <Input
                id="duration_min"
                name="duration_min"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={service ? String(service.duration_min) : "60"}
                placeholder="60"
              />
            </div>
          </div>

          <SizePriceFields idPrefix="service" values={service} />

          <div>
            <Label>Cor na agenda</Label>
            <p className="mb-2 text-xs text-gray-neutral">
              Identifica o serviço no calendário e na legenda. Sem escolher,
              a agenda usa uma cor automática, sempre a mesma.
            </p>
            {colorHex && (
              <input type="hidden" name="color_hex" value={colorHex} />
            )}
            <ColorSwatchInput
              aria-label="Cor do serviço na agenda"
              options={AGENDA_COLORS}
              value={colorName}
              onChange={(option) => setColorHex(option?.hex ?? null)}
              allowCustom
              customValue={colorHex}
              onCustomChange={setColorHex}
              customPreviewLabel={service?.name || "Serviço"}
            />
          </div>

          <Checkbox
            name="active"
            defaultChecked={service ? service.active : true}
            label="Ativo (visível no app)"
          />

          <div>
            <Label>Passo a passo do atendimento</Label>
            <p className="mb-2 text-xs text-gray-neutral">
              Escolha as etapas da biblioteca do petshop e defina a ordem. Elas
              viram o checklist ao iniciar o atendimento.
            </p>

            {/* A ordem do FormData segue a ordem no DOM, então a lista abaixo
                é a ordem enviada ao servidor. */}
            {stepIds.map((id) => (
              <input key={id} type="hidden" name="step_ids" value={id} />
            ))}

            {library.length === 0 ? (
              <div className="rounded-xl border border-dashed border-graphite/15 bg-surface-muted p-4 text-center">
                <p className="text-sm text-gray-neutral">
                  Nenhuma etapa cadastrada na biblioteca do petshop.
                </p>
                <Link
                  href="/configuracoes"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange"
                >
                  Cadastrar etapas em Configurações
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <>
                {selected.length > 0 && (
                  <ul className="space-y-2">
                    {selected.map((step, i) => (
                      <li
                        key={step.id}
                        className="flex items-center gap-2 rounded-xl border border-graphite/10 px-3 py-2"
                      >
                        <span className="w-4 shrink-0 text-xs font-medium tabular-nums text-gray-neutral">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-graphite">
                          {step.label}
                        </span>
                        <button
                          type="button"
                          aria-label="Mover para cima"
                          onClick={() => moveStep(i, -1)}
                          disabled={i === 0}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Mover para baixo"
                          onClick={() => moveStep(i, 1)}
                          disabled={i === selected.length - 1}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover ${step.label}`}
                          onClick={() =>
                            setStepIds((prev) => prev.filter((id) => id !== step.id))
                          }
                          className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <Select
                  aria-label="Adicionar etapa"
                  className="mt-2"
                  value=""
                  disabled={available.length === 0}
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id) setStepIds((prev) => [...prev, id]);
                  }}
                >
                  <option value="" disabled>
                    {available.length > 0
                      ? "Adicionar etapa..."
                      : "Todas as etapas já foram adicionadas"}
                  </option>
                  {available.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
