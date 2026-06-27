"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Button, CurrencyInput, Dialog, Input, Label } from "@mylivepet/ui";
import {
  createServiceType,
  updateServiceType,
  type FormState,
} from "@/app/(app)/servicos/actions";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_min: number;
  active: boolean;
  default_steps: string[];
};

export function ServiceDialog({ service }: { service?: ServiceRow }) {
  const router = useRouter();
  const isEdit = !!service;
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<string[]>(service?.default_steps ?? []);
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

  // Sincroniza os passos com o serviço sempre que o diálogo é aberto.
  useEffect(() => {
    if (open) setSteps(service?.default_steps ?? []);
  }, [open, service]);

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
              <Label htmlFor="price">Preço *</Label>
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

          <label className="flex items-center gap-2 text-sm text-graphite">
            <input
              type="checkbox"
              name="active"
              defaultChecked={service ? service.active : true}
              className="h-4 w-4 accent-orange"
            />
            Ativo (visível no app)
          </label>

          <div>
            <Label>Passo a passo do atendimento</Label>
            <p className="mb-2 text-xs text-gray-neutral">
              Esses passos aparecem como checklist ao iniciar o atendimento.
            </p>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    name="steps"
                    value={step}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                    }
                    placeholder={`Ex.: ${i === 0 ? "Recepção do pet" : "Banho concluído"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Remover passo ${i + 1}`}
                    className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => setSteps((prev) => [...prev, ""])}
            >
              <Plus className="h-4 w-4" /> Adicionar passo
            </Button>
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
