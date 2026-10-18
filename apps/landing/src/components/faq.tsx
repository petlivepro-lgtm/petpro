import { Plus } from "lucide-react";
import { SectionTitle, WRAP } from "./layout";

const questions = [
  {
    q: "Preciso de câmera para usar o Pet Live Pro?",
    a: "Não. Agenda, atendimentos, leva-e-traz, Clubinho, estoque e caixa funcionam sem câmera. A transmissão ao vivo é um recurso a mais, que você liga quando quiser.",
  },
  {
    q: "Quais câmeras funcionam?",
    a: "Hoje, a Tapo C200. Ela fica na sala e se conecta por um serviço instalado num computador do próprio petshop, sem abrir portas no roteador.",
  },
  {
    q: "Outro tutor consegue ver o pet do meu cliente?",
    a: "Não. Cada tutor recebe acesso apenas ao atendimento do próprio pet, por tempo limitado, e aceita o termo de uso de imagem no primeiro acesso.",
  },
  {
    q: "Por quanto tempo as gravações ficam guardadas?",
    a: "Por 7, 15 ou 30 dias, conforme você configurar. Depois disso, elas são apagadas automaticamente.",
  },
  {
    q: "O tutor precisa baixar um aplicativo?",
    a: "Não precisa ir à loja de apps. O app do tutor abre no navegador do celular e pode ser instalado na tela inicial com um toque.",
  },
  {
    q: "Meus colaboradores usam o mesmo sistema?",
    a: "Sim. Cada colaborador tem seu próprio acesso, e o entregador do leva-e-traz vê a rota do dia no painel dele.",
  },
];

export function Faq() {
  return (
    <section id="duvidas" className={`${WRAP} grid gap-8 pt-24 lg:grid-cols-[420px_1fr] lg:gap-16 lg:pt-32`} aria-labelledby="duvidas-titulo">
      <SectionTitle id="duvidas-titulo" lead="Dúvidas" accent="de balcão." className="text-[clamp(2rem,3.6vw,2.75rem)] leading-[1.08]" />
      <div>
        {questions.map(({ q, a }, i) => (
          <details key={q} open={i === 0} className="group border-b border-[#e6eaee] first:border-t">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-[22px] font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
              {q}
              <Plus
                aria-hidden
                className="title-accent h-[22px] w-[22px] shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-open:rotate-45"
                strokeWidth={2.6}
              />
            </summary>
            <p className="max-w-[68ch] pb-6 pr-12 text-[16.5px] leading-relaxed text-[#5d6873]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
