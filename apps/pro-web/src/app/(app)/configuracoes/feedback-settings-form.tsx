"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, Select } from "@mylivepet/ui";
import {
  FEEDBACK_FIELD_TYPES,
  FEEDBACK_FIELD_TYPE_LABEL,
  type FeedbackField,
  type FeedbackFieldType,
} from "@mylivepet/types";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { updateFeedbackConfig, type FormState } from "./actions";

const PLACEHOLDER: Record<FeedbackFieldType, string> = {
  STARS: "Ex.: Como foi nosso atendimento?",
  SCALE_10: "Ex.: De 0 a 10, recomendaria nosso petshop?",
  TEXT: "Ex.: Deixe um comentário",
};

function newField(): FeedbackField {
  return { id: crypto.randomUUID(), type: "STARS", label: "", required: true };
}

export function FeedbackSettingsForm({ fields: initial }: { fields: FeedbackField[] }) {
  const router = useRouter();
  const [fields, setFields] = useState<FeedbackField[]>(initial);
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateFeedbackConfig,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  function update(id: string, patch: Partial<FeedbackField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function remove(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <Card className="max-w-2xl p-6">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-semibold text-graphite">Avaliação do tutor</h2>
        <p className="text-sm text-gray-neutral">
          Monte o formulário que o tutor preenche após o atendimento. Sem campos, ele verá a
          avaliação padrão (estrelas + comentário).
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="config" value={JSON.stringify({ fields })} />

        {fields.length === 0 && (
          <p className="rounded-xl bg-surface-muted p-3 text-sm text-gray-neutral">
            Nenhum campo configurado.
          </p>
        )}

        <div className="space-y-4">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-xl border border-graphite/10 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-medium text-gray-neutral">Campo {i + 1}</span>
                <div className="ml-auto flex items-center gap-1">
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
                    disabled={i === fields.length - 1}
                    className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remover campo"
                    onClick={() => remove(f.id)}
                    className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <div>
                  <Label htmlFor={`type-${f.id}`}>Tipo</Label>
                  <Select
                    id={`type-${f.id}`}
                    value={f.type}
                    onChange={(e) => update(f.id, { type: e.target.value as FeedbackFieldType })}
                  >
                    {FEEDBACK_FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {FEEDBACK_FIELD_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`label-${f.id}`}>Pergunta</Label>
                  <Input
                    id={`label-${f.id}`}
                    value={f.label}
                    onChange={(e) => update(f.id, { label: e.target.value })}
                    placeholder={PLACEHOLDER[f.type]}
                  />
                </div>
              </div>

              <label className="mt-3 flex items-center gap-2 text-sm text-graphite">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => update(f.id, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-graphite/30 text-orange focus-visible:ring-orange"
                />
                Resposta obrigatória
              </label>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setFields((prev) => [...prev, newField()])}
          disabled={fields.length >= 10}
        >
          <Plus className="h-4 w-4" /> Adicionar campo
        </Button>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {saved && <p className="text-sm text-success">Alterações salvas.</p>}

        <div className="flex justify-end border-t border-graphite/5 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar avaliação"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
