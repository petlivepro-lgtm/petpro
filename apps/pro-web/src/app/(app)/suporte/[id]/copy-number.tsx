"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** "#1003" que copia ao clicar — para citar o chamado no WhatsApp ou por telefone. */
export function CopyNumber({ number }: { number: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`#${number}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* sem permissão de área de transferência: nada a fazer */
        }
      }}
      title="Copiar número do chamado"
      className="inline-flex items-center gap-1 rounded-md font-semibold tabular-nums text-graphite/80 transition-colors hover:text-graphite"
    >
      #{number}
      {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden /> : <Copy className="h-3.5 w-3.5 opacity-60" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Número copiado" : ""}
      </span>
    </button>
  );
}
