"use client";

import { useTransition } from "react";
import { Button, Input, Label } from "@mylivepet/ui";
import { addStep, toggleStep } from "@/app/(app)/atendimentos/[id]/actions";

export type ChecklistStep = { id: string; label: string; done: boolean };

export function AppointmentChecklist({
  appointmentId,
  steps,
}: {
  appointmentId: string;
  steps: ChecklistStep[];
}) {
  const [pending, startTransition] = useTransition();

  function onToggle(step: ChecklistStep, done: boolean) {
    const fd = new FormData();
    fd.set("step_id", step.id);
    fd.set("appointment_id", appointmentId);
    fd.set("done", String(done));
    startTransition(() => {
      void toggleStep(fd);
    });
  }

  return (
    <div className="space-y-4">
      {steps.length > 0 && (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.id}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-graphite transition-colors hover:bg-orange/5">
                <input
                  type="checkbox"
                  checked={step.done}
                  disabled={pending}
                  onChange={(e) => onToggle(step, e.target.checked)}
                  className="h-4 w-4 accent-orange"
                />
                <span className={step.done ? "text-gray-neutral line-through" : ""}>
                  {step.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <form action={addStep} className="space-y-2">
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <Label htmlFor="label">Adicionar passo</Label>
        <div className="flex gap-2">
          <Input id="label" name="label" required placeholder="Ex.: Banho concluído" />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}
