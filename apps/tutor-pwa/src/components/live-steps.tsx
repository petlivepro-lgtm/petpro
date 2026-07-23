"use client";

import { useCallback } from "react";
import { Check, Loader2 } from "lucide-react";
import { Card } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import type { LiveStep } from "@/app/(app)/ao-vivo/actions";

function fmtTime(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Barra de progresso do atendimento, logo abaixo do ao vivo: cada etapa que o
 * petshop marca no checklist chega aqui na hora (Supabase Realtime em
 * `appointment_step`, filtrado pelo atendimento e limitado pela RLS).
 */
export function LiveSteps({
  appointmentId,
  initial,
}: {
  appointmentId: string;
  initial: LiveStep[];
}) {
  const fetcher = useCallback(async (): Promise<LiveStep[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("appointment_step")
      .select("id, label, position, done, done_at")
      .eq("appointment_id", appointmentId)
      .order("position", { ascending: true });
    return data ?? [];
  }, [appointmentId]);

  const steps = useRealtimeList<LiveStep>(
    initial,
    fetcher,
    [{ table: "appointment_step", filter: `appointment_id=eq.${appointmentId}` }],
    `live:steps:${appointmentId}`,
  );

  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const current = steps.find((s) => !s.done) ?? null;

  return (
    <Card className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-heading font-semibold text-graphite">Etapas do atendimento</p>
        <p className="text-sm text-gray-neutral">
          {doneCount} de {steps.length}
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-soft"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso do atendimento"
      >
        <div
          className="h-full rounded-full bg-orange transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ul className="space-y-2">
        {steps.map((step) => {
          const isCurrent = current?.id === step.id;
          const time = fmtTime(step.done_at);
          return (
            <li key={step.id} className="flex items-center gap-3">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  step.done
                    ? "border-orange bg-orange text-white"
                    : isCurrent
                      ? "border-orange text-orange"
                      : "border-gray-soft text-gray-neutral",
                ].join(" ")}
              >
                {step.done ? (
                  <Check className="h-3.5 w-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
              </span>
              <span
                className={[
                  "min-w-0 flex-1 truncate text-sm",
                  step.done
                    ? "text-graphite"
                    : isCurrent
                      ? "font-medium text-graphite"
                      : "text-gray-neutral",
                ].join(" ")}
              >
                {step.label}
              </span>
              {step.done && time && (
                <span className="shrink-0 text-xs text-gray-neutral">{time}</span>
              )}
              {isCurrent && (
                <span className="shrink-0 text-xs font-medium text-orange">agora</span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
