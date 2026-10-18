"use client";

import Image from "next/image";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { PauseButton } from "./pause-button";
import { useDayClock } from "./use-day-clock";
import { prefersReducedMotion } from "./use-in-view";

type Col = "chegou" | "banho" | "tosa" | "pronto";

const COLUMNS: { id: Col; label: string; color: string }[] = [
  { id: "chegou", label: "Chegou", color: "var(--st-chegou)" },
  { id: "banho", label: "No banho", color: "var(--st-banho)" },
  { id: "tosa", label: "Na tosa", color: "var(--st-tosa)" },
  { id: "pronto", label: "Pronto", color: "var(--st-pronto)" },
];

// Pets do dia (exemplo). `cam` é a foto da câmera da sala enquanto ele está em atendimento.
const PETS: Record<string, { name: string; img: string; service: string; done: string; tutor?: string; cam?: string }> = {
  nina: { name: "Nina", img: "/img/pet-nina.jpg", service: "Banho · Porte P", done: "Tutora avisada", tutor: "Paula" },
  bob: { name: "Bob", img: "/img/pet-bob.jpg", service: "Banho · leva-e-traz", done: "Saiu para entrega", tutor: "Diego" },
  max: { name: "Max", img: "/img/pet-max.jpg", service: "Banho e tosa · 15:00", done: "Tutor avisado", tutor: "Bruno" },
  thor: { name: "Thor", img: "/img/banho-chuveiro.jpg", service: "Banho + hidratação", done: "Boletim enviado", tutor: "Ana", cam: "/img/banho-chuveiro.jpg" },
  luna: { name: "Luna", img: "/img/tosa-tesoura.jpg", service: "Tosa na tesoura", done: "Boletim enviado", tutor: "Rafael", cam: "/img/tosa-tesoura.jpg" },
  pipoca: { name: "Pipoca", img: "/img/secagem-toalha.jpg", service: "Banho", done: "Boletim enviado" },
  mel: { name: "Mel", img: "/img/pet-mel.jpg", service: "Banho", done: "A caminho · 9 min" },
};

// Roteiro do dia: em cada passo, quem está em cada coluna. A Luna fica na tosa,
// porque é ela que o Rafael acompanha no celular ao lado.
const STEPS: Record<Col, string[]>[] = [
  { chegou: ["nina", "bob", "max"], banho: ["thor"], tosa: ["luna"], pronto: ["pipoca", "mel"] },
  { chegou: ["bob", "max"], banho: ["thor", "nina"], tosa: ["luna"], pronto: ["pipoca", "mel"] },
  { chegou: ["bob", "max"], banho: ["nina"], tosa: ["luna"], pronto: ["thor", "pipoca"] },
  { chegou: ["max"], banho: ["nina", "bob"], tosa: ["luna"], pronto: ["thor", "pipoca"] },
  { chegou: ["max"], banho: ["bob"], tosa: ["luna"], pronto: ["nina", "thor", "pipoca"] },
];
const LUNA_MINUTES = [12, 15, 18, 21, 24];

export function DayBoard() {
  const { ref: stageRef, step, paused, setPaused } = useDayClock<HTMLDivElement>(STEPS.length, 3600);
  const board = STEPS[step]!;
  const watching = [...board.banho, ...board.tosa].filter((id) => PETS[id]!.tutor).length;

  // FLIP: cada card desliza da posição antiga para a nova quando muda de coluna.
  const rects = useRef(new Map<string, { x: number; y: number }>());
  const phoneRef = useRef<HTMLDivElement>(null);
  const [link, setLink] = useState<{ d: string; x: number; y: number } | null>(null);

  const measureLink = useCallback(() => {
    const stage = stageRef.current;
    const card = stage?.querySelector<HTMLElement>('[data-pet="luna"]');
    const phone = phoneRef.current;
    if (!stage || !card || !phone || window.innerWidth < 1280) return setLink(null);
    const s = stage.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const p = phone.getBoundingClientRect();
    const x1 = c.right - s.left;
    const y1 = c.top - s.top + c.height * 0.55;
    const x2 = p.left - s.left - 6;
    const y2 = p.top - s.top + p.height * 0.62;
    const mid = (x1 + x2) / 2;
    setLink({ d: `M${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`, x: x2, y: y2 });
  }, [stageRef]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const base = stage.getBoundingClientRect();
    const reduce = prefersReducedMotion();
    const next = new Map<string, { x: number; y: number }>();
    stage.querySelectorAll<HTMLElement>("[data-pet]").forEach((el) => {
      const r = el.getBoundingClientRect();
      const pos = { x: r.left - base.left, y: r.top - base.top };
      const prev = rects.current.get(el.dataset.pet!);
      if (!reduce && rects.current.size) {
        if (prev && (prev.x !== pos.x || prev.y !== pos.y)) {
          el.animate(
            [{ transform: `translate(${prev.x - pos.x}px, ${prev.y - pos.y}px)` }, { transform: "none" }],
            { duration: 560, easing: "cubic-bezier(0.77, 0, 0.175, 1)" },
          );
        } else if (!prev) {
          el.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], {
            duration: 360,
            easing: "cubic-bezier(0.23, 1, 0.32, 1)",
          });
        }
      }
      next.set(el.dataset.pet!, pos);
    });
    rects.current = next;
    measureLink();
  }, [step, stageRef, measureLink]);

  useLayoutEffect(() => {
    window.addEventListener("resize", measureLink);
    return () => window.removeEventListener("resize", measureLink);
  }, [measureLink]);

  return (
    <div
      ref={stageRef}
      className="relative rounded-3xl border border-[#e6eaee] bg-[#f4f6f8] p-4 sm:p-6 lg:grid lg:grid-cols-[1fr_250px] lg:gap-10 lg:p-7"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#5d6873]">
            <b className="font-heading text-lg font-bold text-graphite">Terça, 14 de outubro</b>{" "}
            <span className="hidden sm:inline">· 8 atendimentos · 2 no leva-e-traz</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-full border border-[#e6eaee] bg-white px-3 py-[7px] text-[13px] font-semibold">
              <i aria-hidden className="live-dot" />
              <span aria-live="off">{watching} tutores assistindo</span>
            </span>
            <PauseButton paused={paused} onToggle={() => setPaused((p) => !p)} />
          </div>
        </div>

        <div className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-3.5 lg:overflow-visible lg:px-0 lg:pb-0">
          {COLUMNS.map((col) => (
            <div key={col.id} className="w-[236px] shrink-0 snap-start lg:w-auto">
              <h3 className="flex items-center gap-2 px-1 pb-3 font-heading text-[13px] font-bold uppercase tracking-[0.08em]">
                <i aria-hidden className="h-[9px] w-[9px] rounded-full" style={{ background: col.color }} />
                {col.label}
                <small className="ml-auto font-accent text-[12.5px] font-semibold tabular-nums text-[#5d6873]">
                  {board[col.id].length}
                </small>
              </h3>
              <ul className="space-y-2.5">
                {board[col.id].map((id) => (
                  <PetCard key={id} id={id} col={col.id} focus={id === "luna"} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div ref={phoneRef} className="mx-auto mt-8 w-[240px] lg:mt-0">
        <p className="mb-3 text-center text-xs font-semibold text-[#5d6873] xl:invisible">O que o Rafael vê no celular</p>
        <div className="h-[496px] rounded-[38px] bg-[#0d1317] p-2.5 shadow-[0_30px_60px_rgba(31,42,51,.28)]">
          <div className="flex h-full flex-col overflow-hidden rounded-[29px] bg-white">
            <div className="relative h-[220px] shrink-0">
              <Image src="/img/tosa-tesoura.jpg" alt="Luna, uma poodle branca, sendo tosada na tesoura" fill sizes="220px" className="object-cover" priority />
              <span className="live-tag absolute left-2.5 top-2.5">
                <i aria-hidden />
                AO VIVO
              </span>
            </div>
            <div className="p-3.5">
              <b className="font-heading text-[15px] font-bold">Luna está na tosa</b>
              <p className="mt-0.5 text-[11.5px] text-[#5d6873]">
                Tosa na tesoura · com a Carla · há <span className="tabular-nums">{LUNA_MINUTES[step]}</span> min
              </p>
              <div className="mt-3 flex gap-1">
                <i className="h-[5px] flex-1 rounded bg-orange" />
                <i className="h-[5px] flex-1 rounded bg-orange" />
                <i className="h-[5px] flex-1 rounded bg-[#e5e9ec]" />
              </div>
              <div className="mt-1.5 flex justify-between text-[9.5px] font-semibold text-[#5d6873]">
                <span>Chegou</span>
                <span>Na tosa</span>
                <span>Pronto</span>
              </div>
              <div className="mt-3.5 border-t border-[#f4f6f8] pt-2.5">
                <small className="font-heading text-[9.5px] font-bold tracking-[0.12em] text-[#5d6873]">GRAVAÇÕES</small>
                {[
                  ["12/10 · Banho e tosa", "13 dias"],
                  ["05/10 · Banho", "6 dias"],
                ].map(([what, left]) => (
                  <div key={what} className="flex justify-between border-b border-[#f4f6f8] py-1.5 text-[11px]">
                    {what}
                    <span className="text-[#5d6873]">{left}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {link && (
        <>
          <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full xl:block">
            <path d={link.d} stroke="#FF6A00" strokeWidth="2.5" strokeDasharray="6 6" fill="none" />
            <circle cx={link.x} cy={link.y} r="5" fill="#FF6A00" />
          </svg>
          <span
            aria-hidden
            className="pointer-events-none absolute hidden -translate-x-full whitespace-nowrap rounded-full bg-graphite px-2.5 py-1.5 text-xs font-semibold text-white xl:block"
            style={{ left: link.x - 10, top: link.y + 16 }}
          >
            O que o Rafael vê no celular
          </span>
        </>
      )}
    </div>
  );
}

function PetCard({ id, col, focus }: { id: string; col: Col; focus: boolean }) {
  const pet = PETS[id]!;
  const live = col === "banho" || col === "tosa";
  return (
    <li
      data-pet={id}
      className={`grid grid-cols-[44px_1fr] items-center gap-x-[11px] gap-y-2.5 rounded-[14px] bg-white p-3 ${
        focus
          ? "shadow-[0_0_0_2px_var(--orange),0_18px_40px_rgba(31,42,51,.16)]"
          : "shadow-[0_1px_2px_rgba(31,42,51,.05),0_4px_14px_rgba(31,42,51,.06)]"
      }`}
    >
      <Image src={pet.img} alt="" width={44} height={44} className="h-11 w-11 rounded-[11px] object-cover" />
      <div className="min-w-0">
        <b className="font-heading text-[15px] font-bold">{pet.name}</b>
        <p className="mt-0.5 truncate text-xs text-[#5d6873]">{col === "pronto" ? pet.done : pet.service}</p>
      </div>
      {live && pet.cam && (
        <div className="relative col-span-2 h-[150px] overflow-hidden rounded-[10px]">
          <Image src={pet.cam} alt={`Câmera da sala com ${pet.name}`} fill sizes="240px" className="object-cover" />
          <span className="live-tag absolute left-2 top-2">
            <i aria-hidden />
            AO VIVO
          </span>
        </div>
      )}
      {live && (
        <p className="col-span-2 flex items-center gap-[7px] rounded-lg bg-[#fff4ec] px-[9px] py-1.5 text-[11.5px] font-semibold">
          <i aria-hidden className="live-dot" />
          {pet.tutor ? `${pet.tutor} está assistindo` : "Câmera da sala ligada"}
        </p>
      )}
    </li>
  );
}
