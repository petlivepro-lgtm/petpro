"use client";

import { useCallback, useEffect, useState } from "react";
import {
  savePushSubscription,
  removePushSubscription,
} from "@/app/(app)/notification-actions";

/**
 * Estados possíveis do aviso do navegador, do ponto de vista do gestor:
 *
 * - `checking`  — ainda perguntando ao navegador (evita piscar o botão)
 * - `unsupported` — navegador sem Web Push, ou iPhone fora da tela de início
 * - `off`       — dá para ativar
 * - `on`        — este navegador está inscrito
 * - `blocked`   — a permissão foi negada; só nas configurações do navegador
 */
export type PushState = "checking" | "unsupported" | "off" | "on" | "blocked";

/**
 * A chave VAPID vem em base64url; o navegador quer os bytes crus.
 * O buffer é criado explicitamente para o tipo casar com `BufferSource` —
 * um Uint8Array genérico poderia estar sobre SharedArrayBuffer, que a API de
 * push não aceita.
 */
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
 * A inscrição é por aparelho, não por conta: o dono pode ativar no PC da loja
 * e no próprio celular, e cada um vira uma linha em push_subscription.
 */
export function usePush() {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") return;

      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setError("Avisos do navegador não configurados no servidor.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Reaproveita a inscrição existente: pedir outra ao mesmo navegador
      // devolveria erro se as chaves não batessem.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) {
        setError("O navegador devolveu uma inscrição incompleta.");
        return;
      }

      const result = await savePushSubscription({
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
  }, []);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("Não foi possível desligar os avisos.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, error, enable, disable };
}
