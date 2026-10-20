"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { Button, usePush } from "@mylivepet/ui";
import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(app)/notification-actions";

/**
 * Avisos do navegador deste aparelho — o mesmo liga/desliga do sino, num lugar
 * onde o tutor procura quando "não recebe notificação". A inscrição é por
 * aparelho: ativar no celular não ativa no computador.
 */
export function SettingsPush() {
  const { state, busy, error, enable, disable } = usePush({
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    save: savePushSubscription,
    remove: removePushSubscription,
  });

  const copy: Record<typeof state, string> = {
    checking: "Verificando este aparelho…",
    on: "Ativados. Você recebe os avisos do petshop mesmo com o app fechado.",
    off: "Desativados. Os avisos só aparecem no sino, com o app aberto.",
    blocked:
      "Bloqueados pelo navegador. Para liberar, abra as permissões do site no navegador e permita notificações.",
    unsupported:
      "Este navegador não recebe avisos. No iPhone, adicione o app à Tela de Início e abra por lá.",
  };

  const Icon = state === "on" ? BellRing : state === "blocked" || state === "unsupported" ? BellOff : Bell;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-petrol/[0.07] text-petrol">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-graphite">Avisos neste aparelho</p>
        <p className="text-sm text-gray-neutral">{copy[state]}</p>
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
      {state === "off" && (
        <Button type="button" size="sm" onClick={enable} disabled={busy} className="shrink-0">
          {busy ? "Ativando…" : "Ativar avisos"}
        </Button>
      )}
      {state === "on" && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={disable}
          disabled={busy}
          className="shrink-0"
        >
          {busy ? "Desativando…" : "Desativar"}
        </Button>
      )}
    </div>
  );
}
