"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./use-in-view";

const CYCLE = 6500;
const TRAVEL = 0.68;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Leva-e-traz: a van percorre a rota, a contagem cai e, na chegada, "entregue".
export function RouteDemo({ running }: { running: boolean }) {
  const pathRef = useRef<SVGPathElement>(null);
  const vanRef = useRef<SVGCircleElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const [eta, setEta] = useState<number | "done">(9);

  useEffect(() => {
    const path = pathRef.current;
    const van = vanRef.current;
    const pulse = pulseRef.current;
    if (!path || !van || !pulse) return;
    const L = path.getTotalLength();
    path.style.strokeDasharray = String(L);
    const reduce = prefersReducedMotion();

    const draw = (t: number) => {
      const p = ease(Math.min(t / TRAVEL, 1));
      const pt = path.getPointAtLength(p * L);
      van.setAttribute("cx", String(pt.x));
      van.setAttribute("cy", String(pt.y));
      path.style.strokeDashoffset = String(L * (1 - p));
      const arrived = t >= TRAVEL;
      const after = arrived ? (t - TRAVEL) / (1 - TRAVEL) : 0;
      pulse.setAttribute("r", String(arrived ? 10 + after * 26 : 10));
      pulse.setAttribute("opacity", String(arrived && !reduce ? Math.max(0, 0.45 - after * 0.6) : 0));
      setEta(arrived ? "done" : Math.max(1, Math.ceil(9 * (1 - p))));
    };

    if (reduce || !running) {
      draw(reduce ? 1 : 0.4);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      draw(((now - start) % CYCLE) / CYCLE);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const ROUTE = "M30 150 L110 120 L110 55 L270 55 L270 20 L338 20";
  return (
    <div className="relative h-[170px] overflow-hidden rounded-[18px] bg-[#f4f6f8]">
      <svg viewBox="0 0 400 170" className="h-full w-full" fill="none" aria-hidden preserveAspectRatio="xMidYMid slice">
        <g stroke="#e3e8ec" strokeWidth="12">
          <path d="M0 55H400M0 120H400M110 0V170M270 0V170" />
        </g>
        <path d={ROUTE} stroke="#c9d1d8" strokeWidth="3" strokeDasharray="4 7" strokeLinecap="round" />
        <path ref={pathRef} d={ROUTE} stroke="#FF6A00" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx="30" cy="150" r="8" fill="#1F2A33" />
        <circle ref={pulseRef} cx="362" cy="20" r="10" fill="#FF6A00" opacity="0" />
        <g transform="translate(362 26)">
          <path d="M0 4 C -7 -4, -9 -9, -9 -13 A 9 9 0 1 1 9 -13 C 9 -9, 7 -4, 0 4 Z" fill="#1F2A33" />
          <circle cx="0" cy="-13" r="3.6" fill="#fff" />
        </g>
        <circle ref={vanRef} cx="30" cy="150" r="11" fill="#FF6A00" stroke="#fff" strokeWidth="4" />
      </svg>
      <span
        className={`absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-[10px] px-3 py-2 font-heading text-sm font-bold tabular-nums shadow-[0_4px_14px_rgba(31,42,51,.08)] transition-colors duration-300 ${
          eta === "done" ? "bg-[#237a4b] text-white" : "bg-white text-graphite"
        }`}
      >
        {eta === "done" ? (
          <>
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3.2} /> Mel · entregue
          </>
        ) : (
          `Mel · a caminho · ${eta} min`
        )}
      </span>
    </div>
  );
}
