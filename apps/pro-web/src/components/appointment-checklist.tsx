"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { toggleStep } from "@/app/(app)/atendimentos/[id]/actions";

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

  if (steps.length === 0) {
    return (
      <p className="text-sm text-gray-neutral">
        Nenhum passo no fluxo. Cadastre o passo a passo no serviço para vê-lo aqui.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {steps.map((step) => (
        <li key={step.id}>
          <label
            className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
              step.done
                ? "border-orange/20 bg-orange/5"
                : "border-graphite/10 hover:border-orange/40 hover:bg-orange/5"
            } ${pending ? "cursor-wait opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={step.done}
              disabled={pending}
              onChange={(e) => onToggle(step, e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-graphite/25 bg-white text-white transition-colors peer-checked:border-orange peer-checked:bg-orange peer-focus-visible:ring-2 peer-focus-visible:ring-orange/40 peer-focus-visible:ring-offset-2 group-hover:border-orange/50 peer-checked:group-hover:border-orange"
            >
              {step.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span
              className={
                step.done
                  ? "text-gray-neutral line-through"
                  : "font-medium text-graphite"
              }
            >
              {step.label}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
