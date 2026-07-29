"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Input, Select } from "@mylivepet/ui";
import {
  FEEDBACK_FIELD_TYPES,
  FEEDBACK_FIELD_TYPE_LABEL,
  type FeedbackField,
  type FeedbackFieldType,
} from "@mylivepet/types";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { updateFeedbackConfig, type FormState } from "./actions";

const MAX_FIELDS = 10;

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
    <Card className="max-w-3xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="font-heading text-lg font-semibold text-graphite">
          Avaliação do tutor
        </h2>
        <p className="mt-0.5 text-sm text-gray-neutral">
          Formulário que o tutor preenche após o atendimento. Sem campos, ele verá
          a avaliação padrão (estrelas + comentário).
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="config" value={JSON.stringify({ fields })} />

        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-graphite/15 bg-surface-muted p-5 text-center text-sm text-gray-neutral">
            Nenhum campo configurado — o tutor verá a avaliação padrão.
          </div>
        ) : (
          <ul className="space-y-2">
            {fields.map((f, i) => (
              <li
                key={f.id}
                className="rounded-xl border border-graphite/10 p-3 transition-colors focus-within:border-orange/40"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <span className="mt-3 w-4 shrink-0 text-xs font-medium tabular-nums text-gray-neutral">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="grid gap-2.5 sm:grid-cols-[160px_1fr]">
                      <Select
                        aria-label={`Tipo do campo ${i + 1}`}
                        value={f.type}
                        onChange={(e) =>
                          update(f.id, { type: e.target.value as FeedbackFieldType })
                        }
                      >
                        {FEEDBACK_FIELD_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {FEEDBACK_FIELD_TYPE_LABEL[t]}
                          </option>
                        ))}
                      </Select>
                      <Input
                        aria-label={`Pergunta do campo ${i + 1}`}
                        value={f.label}
                        onChange={(e) => update(f.id, { label: e.target.value })}
                        placeholder={PLACEHOLDER[f.type]}
                      />
                    </div>
                    <Checkbox
                      checked={f.required}
                      onChange={(e) => update(f.id, { required: e.target.checked })}
                      label="Resposta obrigatória"
                    />
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
                      disabled={i === fields.length - 1}
                      className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remover campo ${i + 1}`}
                      onClick={() => remove(f.id)}
                      className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite/5 pt-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setFields((prev) => [...prev, newField()])}
              disabled={fields.length >= MAX_FIELDS}
            >
              <Plus className="h-4 w-4" /> Adicionar campo
            </Button>
            {fields.length > 0 && (
              <span className="text-xs text-gray-neutral">
                {fields.length} de {MAX_FIELDS}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            {saved && <p className="text-sm text-success">Alterações salvas.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar avaliação"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
