"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { Button, Checkbox, Dialog, Input, Label, Select } from "@mylivepet/ui";
import { useOpenFromUrl } from "@/lib/use-open-from-url";
import {
  WEEKDAY_LABEL,
  type CollaboratorScheduleInput,
  type Weekday,
} from "@mylivepet/types";
import {
  createCollaborator,
  updateCollaborator,
  type FormState,
} from "@/app/(app)/colaboradores/actions";

export type CollaboratorRow = {
  id: string;
  full_name: string;
  role_title: string | null;
  active: boolean;
  schedules: CollaboratorScheduleInput[];
};

// Semana exibida de segunda a domingo; valores seguem Date.getDay() (0=domingo).
const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

// Opções de horário de 30 em 30 min (mesma granularidade dos slots do tutor).
const TIME_OPTIONS = Array.from({ length: 33 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? "00" : "30";
  return `${String(h).padStart(2, "0")}:${m}`;
});

export function CollaboratorDialog({ collaborator }: { collaborator?: CollaboratorRow }) {
  const router = useRouter();
  const isEdit = !!collaborator;
  const [open, setOpen] = useState(false);

  // Só o gatilho de cadastro responde à paleta; com colaborador é edição.
  useOpenFromUrl("colaborador", () => setOpen(true), !collaborator);
  const [schedules, setSchedules] = useState<CollaboratorScheduleInput[]>(
    collaborator?.schedules ?? [],
  );
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateCollaborator : createCollaborator,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  // Sincroniza os horários com o colaborador sempre que o diálogo é aberto.
  useEffect(() => {
    if (open) setSchedules(collaborator?.schedules ?? []);
  }, [open, collaborator]);

  function toggleDay(weekday: Weekday, on: boolean) {
    setSchedules((prev) =>
      on
        ? [...prev, { weekday, start_time: "09:00", end_time: "18:00" }]
        : prev.filter((s) => s.weekday !== weekday),
    );
  }

  function updateRange(index: number, patch: Partial<CollaboratorScheduleInput>) {
    setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${collaborator!.full_name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo colaborador
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar colaborador" : "Novo colaborador"}
        description="Os horários de trabalho definem a agenda disponível no MyLivePet."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={collaborator!.id} />}
          <input type="hidden" name="schedules" value={JSON.stringify(schedules)} />

          <div>
            <Label htmlFor="full_name">Nome *</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={collaborator?.full_name}
              placeholder="Ex.: Ana Souza"
            />
          </div>

          <div>
            <Label htmlFor="role_title">Cargo/função</Label>
            <Input
              id="role_title"
              name="role_title"
              defaultValue={collaborator?.role_title ?? ""}
              placeholder="Ex.: Banhista, Tosador"
            />
          </div>

          <Checkbox
            name="active"
            defaultChecked={collaborator ? collaborator.active : true}
            label="Ativo (disponível para agendamento no app)"
          />

          <div>
            <Label>Horários de trabalho</Label>
            <p className="mb-2 text-xs text-gray-neutral">
              Marque os dias e as faixas em que o colaborador atende. Os tutores só
              conseguem agendar dentro desses horários.
            </p>
            <div className="space-y-2">
              {WEEK_ORDER.map((weekday) => {
                const dayRanges = schedules
                  .map((s, index) => ({ ...s, index }))
                  .filter((s) => s.weekday === weekday);
                const enabled = dayRanges.length > 0;
                return (
                  <div key={weekday} className="rounded-xl border border-graphite/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Checkbox
                        checked={enabled}
                        onChange={(e) => toggleDay(weekday, e.target.checked)}
                        label={WEEKDAY_LABEL[weekday]}
                      />
                      {enabled && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setSchedules((prev) => [
                              ...prev,
                              { weekday, start_time: "09:00", end_time: "18:00" },
                            ])
                          }
                        >
                          <Plus className="h-3.5 w-3.5" /> Faixa
                        </Button>
                      )}
                    </div>
                    {enabled && (
                      <div className="mt-2 space-y-2">
                        {dayRanges.map((range) => (
                          <div key={range.index} className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select
                                value={range.start_time}
                                onChange={(e) => updateRange(range.index, { start_time: e.target.value })}
                                aria-label={`Início ${WEEKDAY_LABEL[weekday]}`}
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <span className="shrink-0 text-sm text-gray-neutral">até</span>
                            <div className="flex-1">
                              <Select
                                value={range.end_time}
                                onChange={(e) => updateRange(range.index, { end_time: e.target.value })}
                                aria-label={`Fim ${WEEKDAY_LABEL[weekday]}`}
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            {dayRanges.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSchedules((prev) => prev.filter((_, i) => i !== range.index))
                                }
                                aria-label="Remover faixa"
                                className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
