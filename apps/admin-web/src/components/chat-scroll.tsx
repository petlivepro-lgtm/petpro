"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@mylivepet/ui";

/**
 * Área de conversa com rolagem própria. Abre na última mensagem e, quando
 * chega mensagem nova (tempo real), desce sozinha — mas só se a pessoa já
 * estava no fim; quem está lendo algo mais acima não é arrastado.
 */
export function ChatScroll({
  children,
  count,
  conversationKey,
  className,
}: {
  children: React.ReactNode;
  /** Quantidade de mensagens: mudou, pode ter chegado coisa nova. */
  count: number;
  /** Trocou de conversa: volta para o fim sem perguntar. */
  conversationKey: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottom.current = true;
  }, [conversationKey]);

  useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [count]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="log"
      aria-label="Mensagens do chamado"
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
