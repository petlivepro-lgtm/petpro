"use client";

import { useEffect, useRef, useState } from "react";

export type Posicao = {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
};

export type GeoEstado =
  | "off"        // rastreamento desligado (rota não começou)
  | "pedindo"    // esperando o navegador perguntar
  | "ok"
  | "negado"     // o entregador recusou, ou o sistema bloqueia
  | "indisponivel";

/**
 * Posição do aparelho enquanto a rota corre.
 *
 * DESLIGADO POR PADRÃO, e é de propósito: o rastreamento só existe entre
 * "iniciar rota" e "encerrar rota". Fora dessa janela ninguém — nem o petshop,
 * nem o tutor — tem por que saber onde o entregador está.
 *
 * O envio é estrangulado por tempo E por distância: parado no semáforo, o GPS
 * continua disparando eventos, e gravar todos seria escrever no banco dezenas
 * de vezes para dizer a mesma coisa.
 */
export function useGeolocation(
  ativo: boolean,
  onPosicao?: (p: Posicao) => void,
  opcoes?: { minMs?: number; minMetros?: number },
): { posicao: Posicao | null; estado: GeoEstado } {
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const [estado, setEstado] = useState<GeoEstado>("off");
  const ultimoEnvio = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const onPosicaoRef = useRef(onPosicao);
  onPosicaoRef.current = onPosicao;

  const minMs = opcoes?.minMs ?? 15_000;
  // 15m: o bastante para o mapa do tutor andar quase contínuo (uma posição a
  // cada 1–4s de moto) sem gravar a cada leitura parada no semáforo.
  const minMetros = opcoes?.minMetros ?? 15;

  useEffect(() => {
    if (!ativo) {
      setEstado("off");
      ultimoEnvio.current = null;
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setEstado("indisponivel");
      return;
    }

    setEstado("pedindo");
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setEstado("ok");
        const p: Posicao = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          heading: pos.coords.heading ?? undefined,
          speed: pos.coords.speed ?? undefined,
        };
        setPosicao(p);

        const agora = Date.now();
        const anterior = ultimoEnvio.current;
        const longe =
          !anterior || metros(anterior.lat, anterior.lng, p.lat, p.lng) >= minMetros;
        const faz_tempo = !anterior || agora - anterior.at >= minMs;
        if (longe || faz_tempo) {
          ultimoEnvio.current = { at: agora, lat: p.lat, lng: p.lng };
          onPosicaoRef.current?.(p);
        }
      },
      (err) => {
        // PERMISSION_DENIED = 1. Recusar não pode quebrar nada: a tela cai na
        // lista de paradas com o botão do Waze, que é como se trabalhava antes
        // de existir mapa aqui.
        setEstado(err.code === err.PERMISSION_DENIED ? "negado" : "indisponivel");
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );

    return () => navigator.geolocation.clearWatch(id);
  }, [ativo, minMs, minMetros]);

  return { posicao, estado };
}

/** Distância em metros entre dois pontos (Haversine). */
export function metros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
