"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ConfirmDialog, Input } from "@mylivepet/ui";
import {
  DEFAULT_SERVICE_STEP_LABELS,
  SERVICE_STEP_LABEL_MAX,
  SERVICE_STEP_LIBRARY_MAX,
  type ServiceStepTemplate,
} from "@mylivepet/types";
import { ArrowDown, ArrowUp, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { updateStepLibrary, type FormState } from "./actions";

function newStep(label = ""): ServiceStepTemplate {
  return { id: crypto.randomUUID(), label };
}

export function StepLibraryForm({
  steps: initial,
  usage,
}: {
  steps: ServiceStepTemplate[];
  /** id da etapa → nomes dos serviços que a usam, para avisar antes de remover. */
  usage: Record<string, string[]>;
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<ServiceStepTemplate[]>(initial);
  const [saved, setSaved] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<ServiceStepTemplate | null>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateStepLibrary,
    { ok: false },
  );

  // O que esta tela carregou: a action só apaga daqui, para um form aberto com
  // a lista desatualizada não derrubar etapas que ele nunca chegou a ver.
  const knownIds = useMemo(() => initial.map((s) => s.id), [initial]);

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  function update(id: string, label: string) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, label } : s)));
  }
  function remove(id: string) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  /** Etapa em uso pede confirmação: sair daqui a tira do checklist dos serviços. */
  function requestRemove(step: ServiceStepTemplate) {
    if ((usage[step.id]?.length ?? 0) > 0) setPendingRemoval(step);
    else remove(step.id);
  }

  const removalServices = pendingRemoval ? (usage[pendingRemoval.id] ?? []) : [];

  return (
    <Card className="max-w-3xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading text-lg font-semibold text-graphite">
          Etapas do atendimento
        </h2>
        <p className="mt-0.5 text-sm text-gray-neutral">
          Cadastre aqui todas as etapas que o petshop executa. Em cada serviço
          você escolhe quais usar e em que ordem.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input
          type="hidden"
          name="config"
          value={JSON.stringify({ steps, known_ids: knownIds })}
        />

        {steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-graphite/15 bg-surface-muted p-5 text-center">
            <p className="text-sm text-gray-neutral">Nenhuma etapa cadastrada.</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() =>
                setSteps(DEFAULT_SERVICE_STEP_LABELS.map((label) => newStep(label)))
              }
            >
              <Sparkles className="h-4 w-4" /> Usar etapas sugeridas
            </Button>
          </div>
        ) : (
          <>
            <p className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-gray-neutral">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Renomear uma etapa atualiza todos os serviços que a usam.
                Atendimentos já iniciados mantêm o nome de quando começaram.
              </span>
            </p>

            <ul className="space-y-2">
              {steps.map((s, i) => {
                const used = usage[s.id]?.length ?? 0;
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-graphite/10 p-3 transition-colors focus-within:border-orange/40"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="mt-3 w-4 shrink-0 text-xs font-medium tabular-nums text-gray-neutral">
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Input
                          aria-label={`Nome da etapa ${i + 1}`}
                          value={s.label}
                          onChange={(e) => update(s.id, e.target.value)}
                          maxLength={SERVICE_STEP_LABEL_MAX}
                          placeholder="Ex.: Banho"
                        />
                        {used > 0 && (
                          <p className="text-xs text-gray-neutral">
                            Usada em {used} {used === 1 ? "serviço" : "serviços"}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label="Mover para cima"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Mover para baixo"
                          onClick={() => move(i, 1)}
                          disabled={i === steps.length - 1}
                          className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Remover etapa ${i + 1}`}
                          onClick={() => requestRemove(s)}
                          className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite/5 pt-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSteps((prev) => [...prev, newStep()])}
              disabled={steps.length >= SERVICE_STEP_LIBRARY_MAX}
            >
              <Plus className="h-4 w-4" /> Adicionar etapa
            </Button>
            {steps.length > 0 && (
              <span className="text-xs text-gray-neutral">
                {steps.length} de {SERVICE_STEP_LIBRARY_MAX}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            {saved && <p className="text-sm text-success">Alterações salvas.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar etapas"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={!!pendingRemoval}
        onOpenChange={(o) => !o && setPendingRemoval(null)}
        title={`Remover “${pendingRemoval?.label || "etapa"}”?`}
        description={`Esta etapa é usada em ${removalServices.length} ${
          removalServices.length === 1 ? "serviço" : "serviços"
        }: ${removalServices.join(", ")}. Ao salvar, ela sai do checklist desses serviços. Atendimentos já iniciados não mudam.`}
        confirmLabel="Remover"
        confirmVariant="danger"
        onConfirm={() => {
          if (pendingRemoval) remove(pendingRemoval.id);
          setPendingRemoval(null);
        }}
      />
    </Card>
  );
}
