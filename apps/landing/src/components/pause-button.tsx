"use client";

import { Pause, Play } from "lucide-react";

// Controle de pausa exigido para conteúdo que se atualiza sozinho (WCAG 2.2.2).
export function PauseButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      aria-label={paused ? "Retomar demonstração" : "Pausar demonstração"}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#e6eaee] bg-white text-graphite transition-colors hover:bg-[#f4f6f8]"
    >
      {paused ? <Play aria-hidden className="h-3.5 w-3.5" /> : <Pause aria-hidden className="h-3.5 w-3.5" />}
    </button>
  );
}
