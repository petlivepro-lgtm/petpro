"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card, cn } from "@mylivepet/ui";

/**
 * Card de uma assinatura do Clubinho (ficha do pet e lista em /clubinho),
 * recolhido por padrão.
 *
 * Fechado mostra só o cabeçalho (plano, status, preço) — é o bastante para
 * saber que o pet é do pacote. O saldo, os usos, os horários fixos e as ações
 * só aparecem ao abrir pela seta, para a tela não abrir com o card inteiro
 * empurrando o resto para baixo. Sempre começa fechado.
 */
export function ClubinhoCard({
  header,
  actions,
  children,
  className = "mb-6",
}: {
  header: ReactNode;
  /** Botões de editar/pausar/renovar/cancelar — só com o card aberto. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  return (
    <Card className={className}>
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 transition-[padding,border-color]",
          open
            ? "border-b border-graphite/5 pb-3"
            : "border-b border-transparent pb-0",
        )}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex shrink-0 items-center gap-1">
          {open && actions}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? "Fechar detalhes do Clubinho" : "Abrir detalhes do Clubinho"}
            title={open ? "Fechar" : "Ver saldo e detalhes"}
            className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
          >
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform duration-300",
                open && "rotate-180",
              )}
            />
          </button>
        </div>
      </div>

      <div
        id={bodyId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </Card>
  );
}
