"use client";

import { useEffect, useRef, useState } from "react";

// Player do ao vivo: tenta WebRTC (WHEP, latência ~1s) e, se a rede do tutor
// bloquear a mídia UDP, cai para HLS (~3-8s de atraso) via hls.js. Ambos os
// endpoints são do MediaMTX do petshop, autenticados pelo `?jwt=` da URL.
// O stream é só vídeo: o gateway já publica o path sem trilha de áudio.
//
// O player NUNCA desiste: cada falha agenda uma nova tentativa. Isso é o que
// faz a troca de sala funcionar — quando o petshop muda a câmera, o path novo
// leva alguns segundos para o ffmpeg conectar, então a primeira tentativa
// sempre encontra "stream não disponível". Sem repetir, o tutor ficaria no
// preto até recarregar a página.

type Phase = "connecting" | "live" | "retrying" | "unstable";

const WHEP_CONNECT_TIMEOUT_MS = 8000;
/** Espera entre tentativas; a última se repete daí em diante. */
const RETRY_DELAYS_MS = [2000, 3000, 5000, 8000, 10000];
/** Depois disso o aviso deixa de ser "reconectando" e assume a instabilidade. */
const UNSTABLE_AFTER_MS = 90_000;

type HttpError = Error & { status?: number };

/**
 * 404/503 = o path ainda não existe ou não está pronto no gateway (câmera
 * recém-trocada). É esperar, não degradar para HLS.
 */
function isStreamNotReady(err: unknown): boolean {
  const status = (err as HttpError)?.status;
  return status === 404 || status === 503;
}

/** Lê os ICE servers (STUN/TURN) dos headers Link da resposta WHEP (OPTIONS). */
function parseIceServers(linkHeader: string | null): RTCIceServer[] {
  if (!linkHeader) return [];
  const servers: RTCIceServer[] = [];
  for (const part of linkHeader.split(/,(?=\s*<)/)) {
    const url = part.match(/<(.+?)>/)?.[1];
    if (!url || !/rel="?ice-server"?/.test(part)) continue;
    const server: RTCIceServer = { urls: url };
    const username = part.match(/username="(.*?)"/)?.[1];
    const credential = part.match(/credential="(.*?)"/)?.[1];
    if (username) server.username = username;
    if (credential) server.credential = credential;
    servers.push(server);
  }
  return servers;
}

async function startWhep(
  video: HTMLVideoElement,
  whepUrl: string,
  signal: AbortSignal,
): Promise<{ pc: RTCPeerConnection; stop: () => void }> {
  const options = await fetch(whepUrl, { method: "OPTIONS", signal });
  const iceServers = parseIceServers(options.headers.get("Link"));

  const pc = new RTCPeerConnection({ iceServers });
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.ontrack = (event) => {
    if (event.streams[0]) video.srcObject = event.streams[0];
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // Sem trickle: espera o ICE gathering terminar (com teto) e manda o SDP completo.
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timer = setTimeout(resolve, 2000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        resolve();
      }
    };
  });

  const response = await fetch(whepUrl, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: pc.localDescription?.sdp ?? offer.sdp,
    signal,
  });
  if (!response.ok) {
    pc.close();
    const err: HttpError = new Error(`WHEP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  await pc.setRemoteDescription({ type: "answer", sdp: await response.text() });

  const location = response.headers.get("Location");
  const sessionUrl = location ? new URL(location, whepUrl).toString() : null;
  return {
    pc,
    stop: () => {
      pc.close();
      if (sessionUrl) fetch(sessionUrl, { method: "DELETE" }).catch(() => {});
    },
  };
}

async function startHls(
  video: HTMLVideoElement,
  hlsUrl: string,
  onFatal: () => void,
): Promise<(() => void) | null> {
  // hls.js só entra no bundle quando o fallback é realmente necessário.
  const { default: Hls } = await import("hls.js");
  const jwt = new URL(hlsUrl).searchParams.get("jwt");
  if (Hls.isSupported()) {
    const hls = new Hls({
      // O MediaMTX autentica cada request do HLS — reabre o XHR garantindo o
      // `?jwt=` também nos segmentos (o playlist só o tem na URL inicial).
      xhrSetup: (xhr, url) => {
        const u = new URL(url, window.location.href);
        if (jwt && !u.searchParams.has("jwt")) u.searchParams.set("jwt", jwt);
        xhr.open("GET", u.toString(), true);
      },
    });
    // Sem isto, um 404 na playlist (path ainda não pronto) matava o player em
    // silêncio — era a origem do "só volta se eu der refresh".
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) onFatal();
    });
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    return () => hls.destroy();
  }
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = hlsUrl;
    video.addEventListener("error", onFatal, { once: true });
    return () => {
      video.removeEventListener("error", onFatal);
      video.removeAttribute("src");
    };
  }
  return null;
}

export function LivePlayer({ whepUrl, hlsUrl }: { whepUrl: string; hlsUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    let abort = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let failingSince: number | null = null;

    /** Guarda o último quadro para o aviso não cair sobre um retângulo preto. */
    const freezeFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas || !video.videoWidth) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
    };

    /** Encerra a tentativa atual sem deixar PeerConnection nem hls.js pendurados. */
    const teardown = () => {
      clearTimeout(watchdog);
      abort.abort();
      cleanup?.();
      cleanup = null;
      video.srcObject = null;
      video.removeAttribute("src");
    };

    const scheduleRetry = () => {
      if (cancelled) return;
      freezeFrame();
      teardown();
      failingSince ??= Date.now();
      setPhase(Date.now() - failingSince > UNSTABLE_AFTER_MS ? "unstable" : "retrying");
      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
      attempt += 1;
      retryTimer = setTimeout(connect, delay);
    };

    const tryHls = () => {
      if (cancelled) return;
      clearTimeout(watchdog);
      cleanup?.();
      cleanup = null;
      video.srcObject = null;
      void startHls(video, hlsUrl, scheduleRetry).then((stop) => {
        if (cancelled) return stop?.();
        if (!stop) return scheduleRetry();
        cleanup = stop;
      });
    };

    // Arrow (e não `function`): declaração hoisted perderia o estreitamento de
    // `video` para não-nulo feito lá em cima.
    const connect = async () => {
      if (cancelled) return;
      abort = new AbortController();
      try {
        const session = await startWhep(video, whepUrl, abort.signal);
        if (cancelled) return session.stop();
        cleanup = session.stop;

        // Se o WebRTC não conectar a tempo (UDP bloqueado), troca para HLS.
        watchdog = setTimeout(() => {
          if (session.pc.connectionState !== "connected") tryHls();
        }, WHEP_CONNECT_TIMEOUT_MS);
        session.pc.onconnectionstatechange = () => {
          const state = session.pc.connectionState;
          if (state === "connected") {
            clearTimeout(watchdog);
          } else if (state === "failed" || state === "closed" || state === "disconnected") {
            // Queda depois de conectado (a câmera do petshop oscilou): volta
            // para a fila de tentativas em vez de congelar de vez.
            clearTimeout(watchdog);
            scheduleRetry();
          }
        };
      } catch (err) {
        if (cancelled) return;
        if (isStreamNotReady(err)) scheduleRetry();
        else tryHls();
      }
    };

    // "playing" é o único sinal de que há imagem de verdade — vale para WebRTC
    // e para HLS. O selo AO VIVO passa a depender dele, e não de "o hls.js foi
    // criado", que acendia o selo sobre um player vazio.
    const onPlaying = () => {
      if (cancelled) return;
      attempt = 0;
      failingSince = null;
      setPhase("live");
    };
    video.addEventListener("playing", onPlaying);

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      video.removeEventListener("playing", onPlaying);
      teardown();
    };
  }, [whepUrl, hlsUrl]);

  const waiting = phase === "connecting" || phase === "retrying" || phase === "unstable";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-graphite">
      <canvas
        ref={canvasRef}
        aria-hidden
        className={`absolute inset-0 h-full w-full object-contain transition-opacity ${
          waiting ? "opacity-40" : "opacity-0"
        }`}
      />
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        className="relative aspect-video w-full object-contain"
      />
      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <p className="text-sm text-white/80">
            {phase === "connecting"
              ? "Conectando à câmera..."
              : phase === "retrying"
                ? "Reconectando à câmera..."
                : "A transmissão desta sala está instável. Seguimos tentando."}
          </p>
        </div>
      )}
      {phase === "live" && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
        </span>
      )}
    </div>
  );
}
