"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, useInView } from "./use-in-view";

// Cenas ilustrativas (vídeos do Pexels): o mesmo pet passando pelas salas do petshop.
const CAMS = [
  { cam: "CAM 01", room: "Banho", src: "/video/banho.mp4", poster: "/video/banho.jpg", start: [10, 32, 8] },
  { cam: "CAM 02", room: "Enxágue", src: "/video/enxague.mp4", poster: "/video/enxague.jpg", start: [10, 41, 15] },
  { cam: "CAM 03", room: "Tosa", src: "/video/tosa.mp4", poster: "/video/tosa.jpg", start: [11, 5, 42] },
  { cam: "CAM 04", room: "Secagem", src: "/video/secagem.mp4", poster: "/video/secagem.jpg", start: [11, 30, 3] },
] as const;

const fmt = (secs: number) =>
  [Math.floor(secs / 3600) % 24, Math.floor(secs / 60) % 60, secs % 60].map((n) => String(n).padStart(2, "0")).join(":");

export function RoomCams() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // O destaque "ao vivo" segue o pet de sala em sala; vídeos só tocam na tela.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (!inView) {
      videos.current.forEach((v) => v?.pause());
      return;
    }
    videos.current.forEach((v) => v?.play().catch(() => {}));
    const room = setInterval(() => setActive((a) => (a + 1) % CAMS.length), 3800);
    const clock = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      clearInterval(room);
      clearInterval(clock);
    };
  }, [inView]);

  const current = CAMS[active]!;
  return (
    <>
      <p className="mt-4 text-sm text-[#5d6873]" aria-live="off">
        Agora: <b className="font-semibold text-graphite">{current.room}</b> · {current.cam}
      </p>
      <div ref={ref} className="mt-5 grid grid-cols-2 gap-2.5 md:absolute md:inset-y-7 md:left-[310px] md:right-7 md:mt-0">
        {CAMS.map((c, i) => {
          const [h, m, s] = c.start;
          return (
            <div
              key={c.cam}
              data-on={i === active}
              className="cam-tile relative aspect-video overflow-hidden rounded-xl bg-graphite md:aspect-auto"
            >
              <video
                ref={(el) => {
                  videos.current[i] = el;
                }}
                src={c.src}
                poster={c.poster}
                muted
                loop
                playsInline
                preload="metadata"
                aria-label={`${c.cam}, sala de ${c.room.toLowerCase()} (cena ilustrativa)`}
                className="h-full w-full object-cover"
              />
              <span className="live-tag absolute left-2 top-2">
                <i aria-hidden />
                AO VIVO
              </span>
              <span className="absolute bottom-2 left-2 rounded-[5px] bg-[rgba(15,22,27,.72)] px-[7px] py-1 text-[11px] font-semibold text-white">
                {c.cam} · {c.room}
              </span>
              <time className="absolute bottom-2 right-2 hidden font-accent text-[11px] font-semibold tabular-nums text-white/85 [text-shadow:0_1px_4px_rgba(0,0,0,.7)] sm:block">
                {fmt(h * 3600 + m * 60 + s + (i === active ? elapsed : 0))}
              </time>
            </div>
          );
        })}
      </div>
    </>
  );
}
