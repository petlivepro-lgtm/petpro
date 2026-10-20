"use client";

import { BellOff, BellRing, Loader2 } from "lucide-react";
import { usePush } from "@mylivepet/ui";
import { removeAdminPushSubscription, saveAdminPushSubscription } from "@/app/push-actions";

/**
 * Avisos do navegador para a equipe: chamado novo, resposta de cliente,
 * chamado atribuído e upload bloqueado. Fica no rodapé do menu porque o
 * navegador só aceita pedir permissão a partir de um clique, e ali é onde a
 * pessoa vê que existe.
 */
export function PushToggle() {
  const { state, busy, error, enable, disable } = usePush({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    save: saveAdminPushSubscription,
    remove: removeAdminPushSubscription,
  });

  if (state === "checking") return null;

  if (state === "unsupported" || state === "blocked") {
    return (
      <p className="flex items-start gap-2 text-xs leading-relaxed text-white/55">
        <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {state === "blocked"
          ? "Avisos bloqueados neste navegador. Libere nas permissões do site."
          : "Este navegador não recebe avisos. No iPhone, adicione o admin à tela de início."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {state === "on" ? (
        <div className="flex min-h-10 items-center gap-2.5 text-sm text-white/75">
          <BellRing className="h-[18px] w-[18px] shrink-0 text-[#7FD3A6]" strokeWidth={1.75} aria-hidden />
          <span className="flex-1">Avisos ligados</span>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="rounded-md px-2 py-1 text-xs font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            Desligar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="flex min-h-10 w-full items-center gap-2.5 text-left text-sm font-medium text-orange transition-colors hover:text-orange/85 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-[18px] w-[18px] shrink-0 animate-spin" aria-hidden />
          ) : (
            <BellRing className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
          )}
          {busy ? "Ativando…" : "Ativar avisos neste aparelho"}
        </button>
      )}
      {error && <p className="text-xs text-[#F2A38F]">{error}</p>}
    </div>
  );
}
