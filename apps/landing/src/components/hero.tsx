import { DayBoard } from "./day-board";
import { SectionTitle, WRAP } from "./layout";
import { Guarantees, SignupForm } from "./signup-form";

export function Hero() {
  return (
    <section id="topo" aria-labelledby="hero-title">
      <div className={`${WRAP} grid gap-8 pb-10 pt-10 lg:grid-cols-[1fr_minmax(0,500px)] lg:items-end lg:gap-16 lg:pt-16`}>
        <SectionTitle id="hero-title"
          as="h1"
          lead="Todo pet do dia num quadro só."
          accent="E o tutor acompanhando junto."
          className="text-[clamp(2.4rem,5.4vw,4rem)] leading-[1.02] tracking-[-0.04em]"
        />
        <div>
          <p className="text-lg leading-relaxed text-[#5d6873]">
            O Pet Live Pro organiza agenda, atendimentos, leva-e-traz e caixa. Quando o pet entra na sala, a câmera
            abre no celular do tutor.
          </p>
          <div className="mt-5">
            <SignupForm id="petshop-topo" />
            <Guarantees items={["Cadastro pelo site", "Funciona sem câmera", "App do tutor incluso"]} />
          </div>
        </div>
      </div>
      <div className={WRAP}>
        <DayBoard />
        <p className="mt-3 text-right text-xs font-medium text-[#5d6873]">Quadro e telas com dados de exemplo</p>
      </div>
    </section>
  );
}
