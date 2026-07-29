"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Checkbox, Input } from "@mylivepet/ui";
import {
  BEHAVIOR_MIN_REPORTS,
  DEFAULT_BEHAVIOR_CATEGORIES,
  type BehaviorCategory,
} from "@mylivepet/types";
import { ArrowDown, ArrowUp, Info, Plus, Sparkles, Trash2 } from "lucide-react";
import { updateBehaviorConfig, type FormState } from "./actions";

const MAX_CATEGORIES = 8;

function newCategory(): BehaviorCategory {
  return {
    id: crypto.randomUUID(),
    label: "",
    inverted: false,
    required: true,
  };
}

export function BehaviorSettingsForm({
  categories: initial,
}: {
  categories: BehaviorCategory[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<BehaviorCategory[]>(initial);
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateBehaviorConfig,
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

  function update(id: string, patch: Partial<BehaviorCategory>) {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }
  function remove(id: string) {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setCategories((prev) => {
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
          Boletim de comportamento
        </h2>
        <p className="mt-0.5 text-sm text-gray-neutral">
          Categorias que a equipe avalia de 1 a 5 estrelas ao finalizar cada
          atendimento. Sem categorias, só o campo de observação aparece.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input
          type="hidden"
          name="config"
          value={JSON.stringify({ categories })}
        />

        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-graphite/15 bg-surface-muted p-5 text-center">
            <p className="text-sm text-gray-neutral">
              Nenhuma categoria configurada.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setCategories(DEFAULT_BEHAVIOR_CATEGORIES)}
            >
              <Sparkles className="h-4 w-4" /> Usar categorias sugeridas
            </Button>
          </div>
        ) : (
          <>
            {/* A explicação da inversão vive aqui, e não em cada linha. */}
            <p className="flex items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-xs text-gray-neutral">
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>
                Marque <strong className="font-medium">Nota alta é ruim</strong>{" "}
                em categorias como “Ansiedade”: a nota é invertida no cálculo da
                média, para o selo continuar premiando o bom comportamento. O
                selo aparece a partir de {BEHAVIOR_MIN_REPORTS} avaliações.
              </span>
            </p>

            <ul className="space-y-2">
              {categories.map((c, i) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-graphite/10 p-3 transition-colors focus-within:border-orange/40"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    <span className="mt-3 w-4 shrink-0 text-xs font-medium tabular-nums text-gray-neutral">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-2.5">
                      <Input
                        aria-label={`Nome da categoria ${i + 1}`}
                        value={c.label}
                        onChange={(e) => update(c.id, { label: e.target.value })}
                        placeholder="Ex.: Socialização"
                      />
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <Checkbox
                          checked={c.required}
                          onChange={(e) =>
                            update(c.id, { required: e.target.checked })
                          }
                          label="Nota obrigatória"
                        />
                        <Checkbox
                          checked={c.inverted}
                          onChange={(e) =>
                            update(c.id, { inverted: e.target.checked })
                          }
                          label="Nota alta é ruim"
                        />
                      </div>
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
                        disabled={i === categories.length - 1}
                        className="rounded-lg p-1.5 text-gray-neutral hover:bg-surface-muted disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remover categoria ${i + 1}`}
                        onClick={() => remove(c.id)}
                        className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-graphite/5 pt-4">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCategories((prev) => [...prev, newCategory()])}
              disabled={categories.length >= MAX_CATEGORIES}
            >
              <Plus className="h-4 w-4" /> Adicionar categoria
            </Button>
            {categories.length > 0 && (
              <span className="text-xs text-gray-neutral">
                {categories.length} de {MAX_CATEGORIES}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {state.error && <p className="text-sm text-danger">{state.error}</p>}
            {saved && <p className="text-sm text-success">Alterações salvas.</p>}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar boletim"}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
