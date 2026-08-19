"use client";

import * as React from "react";

/**
 * Estados do aviso do navegador, do ponto de vista de quem usa:
 *
 * - `checking`    — ainda perguntando ao navegador (evita piscar o botão)
 * - `unsupported` — navegador sem Web Push, ou iPhone fora da tela de início
 * - `off`         — dá para ativar
 * - `on`          — este aparelho está inscrito
 * - `blocked`     — permissão negada; só nas configurações do navegador
 */
export type PushState = "checking" | "unsupported" | "off" | "on" | "blocked";

export type SavePushResult = { ok: boolean; error?: string };

export type UsePushOptions = {
  /** Chave VAPID pública (NEXT_PUBLIC_...), em base64url. */
  vapidPublicKey?: string;
  /** Caminho do service worker servido na raiz do app. */
  swPath?: string;
  /** Server action que grava a inscrição. */
  save: (input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) => Promise<SavePushResult>;
  /** Server action que apaga a inscrição deste aparelho. */
  remove: (endpoint: string) => Promise<void>;
};

/** A chave VAPID vem em base64url; o navegador quer os bytes crus. O buffer é
 * criado explicitamente para o tipo casar com `BufferSource` — um Uint8Array
 * genérico poderia estar sobre SharedArrayBuffer, que a API não aceita. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function supported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Liga/desliga o Web Push deste navegador.
 *
 * A inscrição é por aparelho, não por conta: a mesma pessoa pode ativar no PC
 * e no celular, e cada um vira uma linha em push_subscription.
 */
export function usePush({
  vapidPublicKey,
  swPath = "/sw.js",
  save,
  remove,
}: UsePushOptions) {
  const [state, setState] = React.useState<PushState>("checking");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register(swPath);
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [swPath]);

  const enable = React.useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") return;

      if (!vapidPublicKey) {
        setError("Avisos do navegador não configurados no servidor.");
        return;
      }

      const reg = await navigator.serviceWorker.register(swPath);
      await navigator.serviceWorker.ready;

      // Reaproveita a inscrição existente: pedir outra ao mesmo navegador
      // devolveria erro se as chaves não batessem.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));

      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        setError("O navegador devolveu uma inscrição incompleta.");
        return;
      }

      const result = await save({
        endpoint: sub.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível ativar os avisos.");
        return;
      }
      setState("on");
    } catch {
      setError("Não foi possível ativar os avisos neste navegador.");
    } finally {
      setBusy(false);
    }
  }, [save, swPath, vapidPublicKey]);

  const disable = React.useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(swPath);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await remove(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Não foi possível desligar os avisos.");
    } finally {
      setBusy(false);
    }
  }, [remove, swPath]);

  return { state, busy, error, enable, disable };
}
