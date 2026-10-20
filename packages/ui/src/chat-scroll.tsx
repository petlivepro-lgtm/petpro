"use client";

import * as React from "react";
import { cn } from "./cn";

/**
 * Área de conversa com rolagem própria. Abre na última mensagem e, quando
 * chega mensagem nova (tempo real), desce sozinha — mas só se a pessoa já
 * estava no fim; quem está lendo algo mais acima não é arrastado.
 */
export function ChatScroll({
  children,
  count,
  conversationKey,
  label = "Mensagens do chamado",
  pin = false,
  className,
}: {
  children: React.ReactNode;
  /** Quantidade de mensagens: mudou, pode ter chegado coisa nova. */
  count: number;
  /** Trocou de conversa: volta para o fim sem perguntar. */
  conversationKey: string;
  label?: string;
  /** Virou true (a pessoa acabou de enviar): desce até o fim mesmo se estava lendo acima. */
  pin?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const atBottom = React.useRef(true);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
  }, [conversationKey]);

  React.useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [count]);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !pin) return;
    atBottom.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [pin]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="log"
      aria-label={label}
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className={cn("scrollbar-slim overflow-y-auto overscroll-contain focus-visible:outline-offset-[-2px]", className)}
    >
      {children}
    </div>
  );
}
