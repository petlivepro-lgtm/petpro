import * as React from "react";
import { cn } from "./cn";

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-gray-neutral",
  info: "bg-petrol/10 text-petrol",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-[#8a6418]",
  danger: "bg-danger/10 text-danger",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
