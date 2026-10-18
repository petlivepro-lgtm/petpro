"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { SectionTitle, WRAP } from "./layout";
import { RouteDemo } from "./route-demo";
import { useInView } from "./use-in-view";

export function TutorKnows() {
  const { ref, inView } = useInView<HTMLElement>(0.25);
  return (
    <section ref={ref} data-inview={inView} className={`${WRAP} pt-24 lg:pt-32`} aria-labelledby="sabendo">
      <SectionTitle id="sabendo"
        lead="Quando o pet muda de coluna,"
        accent="o tutor fica sabendo."
        className="max-w-[760px] text-[clamp(2rem,3.6vw,2.75rem)] leading-[1.08]"
      />
      <div className="mt-10 grid gap-10 md:grid-cols-3 lg:gap-10">
        <Item title="Aviso de pronto" text="Saiu da tosa e foi para “Pronto”? O tutor recebe o aviso no celular, sem você parar para mandar mensagem.">
          <PushDemo />
        </Item>
        <Item title="Leva-e-traz com rota" text="A rota do dia no mapa e o aviso de “a caminho” no app do tutor, até a entrega.">
          <RouteDemo running={inView} />
        </Item>
        <Item title="Boletim no fim" text="Como o pet se comportou no secador e na tosa, junto com a gravação do dia.">
          <ReportDemo />
        </Item>
      </div>
    </section>
  );
}

function Item({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div>
      {children}
      <h3 className="mt-6 font-heading text-[19px] font-bold">{title}</h3>
      <p className="mt-2 leading-relaxed text-[#5d6873]">{text}</p>
    </div>
  );
}

// Tela de bloqueio do celular com a notificação descendo do topo.
function PushDemo() {
  return (
    <div className="relative h-[170px] overflow-hidden rounded-[18px] bg-graphite" aria-hidden>
      <Image src="/img/tosa-tesoura.jpg" alt="" fill sizes="400px" className="scale-110 object-cover blur-[14px] brightness-[.6]" />
      <div className="relative flex items-center justify-between px-[22px] pt-3 text-[13px] font-semibold text-white">
        <span className="tabular-nums">12:40</span>
        <span className="flex items-center gap-1.5">
          <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff">
            <rect x="0" y="7" width="3" height="4" rx="1" />
            <rect x="4.5" y="5" width="3" height="6" rx="1" />
            <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
            <rect x="13.5" y="0" width="3" height="11" rx="1" />
          </svg>
          <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
            <rect x=".5" y=".5" width="20" height="10" rx="3" stroke="#fff" opacity=".7" />
            <rect x="2" y="2" width="14" height="7" rx="1.6" fill="#fff" />
            <rect x="21.5" y="3.5" width="1.6" height="4" rx=".8" fill="#fff" opacity=".7" />
          </svg>
        </span>
      </div>
      <div className="push anim-loop absolute inset-x-3.5 top-10 grid grid-cols-[38px_1fr] items-center gap-[11px] rounded-[18px] bg-white/95 px-3.5 py-3 shadow-[0_10px_30px_rgba(0,0,0,.25)] backdrop-blur">
        <span className="grid h-[38px] w-[38px] place-items-center rounded-[10px] bg-white shadow-[inset_0_0_0_1px_#e6eaee]">
          <img src="/brand/faviconpet.svg" alt="" className="w-7" />
        </span>
        <div className="min-w-0">
          <div className="flex justify-between text-[11px] font-semibold text-[#5d6873]">
            <b className="font-bold uppercase tracking-[0.04em]">Pet Live Pro</b>
            <span>agora</span>
          </div>
          <b className="mt-0.5 block font-heading text-[14.5px] font-bold text-graphite">Luna está pronta!</b>
          <p className="truncate text-[12.5px] text-[#5d6873]">Pode buscar a partir das 12h40.</p>
        </div>
      </div>
    </div>
  );
}

// Boletim: as barras se preenchem e o selo de enviado aparece.
function ReportDemo() {
  return (
    <div className="relative flex h-[170px] items-center rounded-[18px] bg-[#f4f6f8] p-5" aria-hidden>
      <div className="grid w-full grid-cols-[52px_1fr] items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 shadow-[0_4px_14px_rgba(31,42,51,.08)]">
        <Image src="/img/secagem-toalha.jpg" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-xl object-cover" />
        <div className="min-w-0">
          <b className="font-heading text-[14.5px] font-bold">Pipoca ficou tranquila</b>
          <p className="truncate text-[12.5px] text-[#5d6873]">Secador: calma · Tosa: colaborou</p>
          <div className="mt-2 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className="seg anim-loop h-[5px] flex-1 rounded-[3px] bg-[#e3e8ec]" />
            ))}
            <i className="h-[5px] flex-1 rounded-[3px] bg-[#e3e8ec]" />
          </div>
        </div>
      </div>
      <span className="sent anim-loop absolute bottom-[18px] right-[30px] flex items-center gap-1.5 rounded-full bg-[#e2f2e9] px-2.5 py-[5px] text-xs font-semibold text-[#1d6a41]">
        <Check aria-hidden className="h-3 w-3" strokeWidth={3.2} /> Enviado para a Júlia
      </span>
    </div>
  );
}
