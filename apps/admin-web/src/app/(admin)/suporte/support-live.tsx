"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@mylivepet/ui";

/**
 * Escuta o stream do suporte e recarrega a tela (lista, conversa e contador
 * do menu) quando qualquer chamado muda. O evento só diz QUAL chamado mudou;
 * os dados vêm do servidor, pelo mesmo guard de sempre.
 */
export function SupportLive() {
  const router = useRouter();
  const [state, setState] = useState<"connecting" | "live" | "offline">("connecting");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const source = new EventSource("/api/suporte/stream");

    source.addEventListener("status", (e) => {
      const { status } = JSON.parse((e as MessageEvent<string>).data) as { status: string };
      setState(status === "SUBSCRIBED" ? "live" : "connecting");
    });
    source.addEventListener("change", () => {
      // Várias mudanças juntas (mensagem + status do chamado) viram um refresh só.
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    });
    source.onerror = () => {
      // 401 fecha de vez (sessão acabou); queda de rede reconecta sozinha.
      setState(source.readyState === EventSource.CLOSED ? "offline" : "connecting");
    };

    return () => {
      if (timer) clearTimeout(timer);
      source.close();
    };
  }, [router]);

  return (
    <span
      role="status"
      className={cn(
        "flex min-h-9 items-center gap-2 rounded-full px-3 text-[13px] font-semibold",
        state === "live" ? "bg-success/10 text-[#22603F]" : "bg-surface-muted text-gray-neutral",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-full",
          state === "live" ? "bg-success motion-safe:animate-pulse" : state === "offline" ? "bg-[#B5442F]" : "bg-gray-neutral",
        )}
      />
      {state === "live" ? "Ao vivo" : state === "offline" ? "Sem conexão — recarregue" : "Conectando…"}
    </span>
  );
}
