import { Cctv, Lock, Monitor, Smartphone } from "lucide-react";
import { SectionTitle, WRAP } from "./layout";

const steps = [
  { time: "11:00", title: "O atendimento começa", text: "No painel, você inicia o atendimento e escolhe a sala. A câmera daquela sala passa a transmitir para aquele pet." },
  { time: "11:01", title: "O tutor assiste", text: "No app do Pet Live Pro, quase em tempo real. Só o tutor daquele pet recebe acesso.", live: true },
  { time: "11:24", title: "O pet muda de sala", text: "Saiu do banho e foi para a tosa? Troque a sala no atendimento e a transmissão vai junto." },
  { time: "12:05", title: "Terminou, desliga", text: "A câmera para ao finalizar. A gravação fica no app pelo prazo que você escolher e o tutor recebe o boletim." },
];

const needs = [
  { icon: Cctv, text: "Câmeras Tapo C200 nas salas de banho, tosa e secagem." },
  { icon: Monitor, text: "Um computador ligado no petshop, que conecta as câmeras com segurança, sem abrir portas no roteador." },
  { icon: Smartphone, text: "O tutor assiste pelo navegador do celular e pode instalar o app na tela inicial." },
  { icon: Lock, text: "Termo de uso de imagem (LGPD) no primeiro acesso e gravações apagadas após 7, 15 ou 30 dias." },
];

export function HowItWorks() {
  return (
    <section id="ao-vivo" className={`${WRAP} pt-24 lg:pt-32`} aria-labelledby="ao-vivo-titulo">
      <SectionTitle id="ao-vivo-titulo" lead="Da sala de banho" accent="ao celular do tutor." className="max-w-[760px] text-[clamp(2rem,3.6vw,2.75rem)] leading-[1.08]" />
      <p className="mt-3.5 max-w-[560px] text-lg leading-relaxed text-[#5d6873]">Como a câmera ao vivo funciona no dia a dia do petshop.</p>

      <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:mt-14 lg:grid-cols-4 lg:gap-8">
        <span
          aria-hidden
          className="absolute inset-x-0 top-[18px] hidden h-0.5 bg-[repeating-linear-gradient(90deg,#d5dbe0_0_8px,transparent_8px_14px)] lg:block"
        />
        {steps.map((s) => (
          <li key={s.time} className="relative">
            <time
              className={`inline-flex items-center gap-[7px] rounded-full border-[1.5px] bg-white px-3.5 py-2 font-accent text-[13px] font-semibold tabular-nums ${
                s.live ? "border-orange shadow-[0_0_0_4px_#fff1e6]" : "border-[#e6eaee]"
              }`}
            >
              {s.live && <i aria-hidden className="live-dot" />}
              {s.time}
            </time>
            <h3 className="mt-5 font-heading text-[19px] font-bold">{s.title}</h3>
            <p className="mt-2 text-[15.5px] leading-relaxed text-[#5d6873]">{s.text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid gap-6 rounded-[20px] bg-[#f4f6f8] p-6 sm:p-8 lg:grid-cols-[240px_1fr] lg:gap-8">
        <h3 className="font-heading text-[22px] font-bold">O que você precisa</h3>
        <ul className="grid gap-5 sm:grid-cols-2 sm:gap-x-8">
          {needs.map(({ icon: Icon, text }) => (
            <li key={text} className="grid grid-cols-[40px_1fr] items-start gap-3 text-[15.5px] leading-relaxed text-[#3a4651]">
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-white">
                <Icon aria-hidden className="h-5 w-5 text-petrol" strokeWidth={2} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-[15px] font-medium text-[#5d6873]">
        Sem câmera, o Pet Live Pro funciona do mesmo jeito: agenda, atendimentos, leva-e-traz, Clubinho, estoque e caixa não
        dependem dela.
      </p>
    </section>
  );
}
