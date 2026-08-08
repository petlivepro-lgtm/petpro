"use client";

import { useEffect, useRef, useState } from "react";

// Player do ao vivo: tenta WebRTC (WHEP, latência ~1s) e, se a rede do tutor
// bloquear a mídia UDP, cai para HLS (~3-8s de atraso) via hls.js. Ambos os
// endpoints são do MediaMTX do petshop, autenticados pelo `?jwt=` da URL.
// O stream é só vídeo: o gateway já publica o path sem trilha de áudio.

type Phase = "connecting" | "webrtc" | "hls" | "error";

const WHEP_CONNECT_TIMEOUT_MS = 8000;

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
  if (!response.ok) throw new Error(`WHEP ${response.status}`);
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
    hls.loadSource(hlsUrl);
    hls.attachMedia(video);
    return () => hls.destroy();
  }
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = hlsUrl;
    return () => {
      video.removeAttribute("src");
    };
  }
  return null;
}

export function LivePlayer({ whepUrl, hlsUrl }: { whepUrl: string; hlsUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<Phase>("connecting");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const abort = new AbortController();

    const fallbackToHls = () => {
      if (cancelled) return;
      cleanup?.();
      cleanup = null;
      video.srcObject = null;
      void startHls(video, hlsUrl).then((stop) => {
        if (cancelled) return stop?.();
        cleanup = stop;
        setPhase(stop ? "hls" : "error");
      });
    };

    (async () => {
      try {
        const session = await startWhep(video, whepUrl, abort.signal);
        if (cancelled) return session.stop();
        cleanup = session.stop;

        // Se o WebRTC não conectar a tempo (UDP bloqueado), troca para HLS.
        const watchdog = setTimeout(() => {
          if (session.pc.connectionState !== "connected") fallbackToHls();
        }, WHEP_CONNECT_TIMEOUT_MS);
        session.pc.onconnectionstatechange = () => {
          if (session.pc.connectionState === "connected") {
            clearTimeout(watchdog);
            setPhase("webrtc");
          } else if (["failed", "closed"].includes(session.pc.connectionState)) {
            clearTimeout(watchdog);
            fallbackToHls();
          }
        };
      } catch {
        fallbackToHls();
      }
    })();

    return () => {
      cancelled = true;
      abort.abort();
      cleanup?.();
    };
  }, [whepUrl, hlsUrl]);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-graphite">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        controls
        className="aspect-video w-full object-contain"
      />
      {phase === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-white/80">Conectando à câmera...</p>
        </div>
      )}
      {phase === "error" && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
          <p className="text-sm text-white/80">
            Não foi possível conectar. Verifique sua internet e tente de novo em instantes.
          </p>
        </div>
      )}
      {(phase === "webrtc" || phase === "hls") && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> AO VIVO
        </span>
      )}
    </div>
  );
}
