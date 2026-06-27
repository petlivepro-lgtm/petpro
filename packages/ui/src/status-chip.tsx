import * as React from "react";
import { cn } from "./cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const tones: Record<Tone, { dot: string; text: string; bg: string }> = {
  neutral: { dot: "bg-gray-neutral", text: "text-gray-neutral", bg: "bg-surface-muted" },
  info: { dot: "bg-petrol", text: "text-petrol", bg: "bg-petrol/10" },
  success: { dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  warning: { dot: "bg-warning", text: "text-[#8a6418]", bg: "bg-warning/15" },
  danger: { dot: "bg-danger", text: "text-danger", bg: "bg-danger/10" },
  brand: { dot: "bg-orange", text: "text-orange", bg: "bg-orange/10" },
};

/** Pílula de status com ponto colorido (estilo "Internado" / "Em atendimento"). */
export function StatusChip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        t.bg,
        t.text,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}
