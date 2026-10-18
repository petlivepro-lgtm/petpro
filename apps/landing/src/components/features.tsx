import { SectionTitle, WRAP } from "./layout";
import { RoomCams } from "./room-cams";

const card = "relative overflow-hidden rounded-[20px] bg-[#f4f6f8] p-7";
const h3 = "font-heading text-xl font-bold";
const desc = "mt-2 max-w-[300px] text-[15px] leading-relaxed text-[#5d6873]";

export function Features() {
  return (
    <section id="recursos" className={`${WRAP} pt-24 lg:pt-32`} aria-labelledby="recursos-titulo">
      <SectionTitle id="recursos-titulo"
        lead="Tudo o que acontece no balcão,"
        accent="num lugar só."
        className="max-w-[700px] text-[clamp(2rem,3.6vw,2.75rem)] leading-[1.08]"
      />
      <p className="mt-3.5 max-w-[560px] text-lg leading-relaxed text-[#5d6873]">
        O quadro é a parte que o tutor vê. Por trás dele, o petshop inteiro.
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-6 md:auto-rows-[150px]">
        <article className={`${card} md:col-span-6 md:row-span-2 lg:col-span-4`}>
          <h3 className={h3}>Câmera ao vivo por sala</h3>
          <p className={desc}>O pet troca de sala e a transmissão vai junto. Cada tutor vê só o próprio pet.</p>
          <RoomCams />
        </article>

        <article className={`${card} min-h-[260px] md:col-span-3 md:row-span-2 lg:col-span-2`}>
          <h3 className={h3}>Preço por porte</h3>
          <p className={desc}>Serviços e adicionais com valor para cada tamanho.</p>
          <div className="absolute bottom-7 left-7 flex gap-2">
            {[
              ["P", "R$ 55"],
              ["M", "R$ 70"],
              ["G", "R$ 90"],
            ].map(([size, price]) => (
              <div key={size} className="rounded-xl bg-white px-3.5 py-2.5 text-center">
                <b className="block font-heading text-lg font-bold">{size}</b>
                <small className="font-accent text-xs font-semibold tabular-nums text-[#5d6873]">{price}</small>
              </div>
            ))}
          </div>
        </article>

        <article className={`${card} min-h-[240px] md:col-span-3 md:row-span-2 lg:col-span-2`}>
          <h3 className={h3}>Clubinho</h3>
          <p className={desc}>Pacotes recorrentes com saldo de banhos.</p>
          <div className="absolute bottom-[30px] left-7 flex gap-2" aria-label="4 de 6 banhos usados">
            {[1, 1, 1, 1, 0, 0].map((on, i) => (
              <i
                key={i}
                className={`h-7 w-7 rounded-full ${on ? "bg-orange" : "bg-white shadow-[inset_0_0_0_2px_#d5dbe0]"}`}
              />
            ))}
          </div>
        </article>

        <article className={`${card} min-h-[240px] md:col-span-3 md:row-span-2 lg:col-span-2`}>
          <h3 className={h3}>Caixa e estoque</h3>
          <p className={desc}>Receitas, despesas e vendas de balcão.</p>
          <div className="absolute inset-x-7 bottom-6 text-[13px]">
            {[
              ["Banho · Thor", "R$ 90,00"],
              ["Balcão · shampoo", "R$ 39,90"],
            ].map(([what, value], i) => (
              <div key={what} className={`flex justify-between py-[7px] ${i === 0 ? "border-b border-[#e3e8ec]" : ""}`}>
                {what}
                <b className="font-accent font-semibold tabular-nums">{value}</b>
              </div>
            ))}
          </div>
        </article>

        <article className={`${card} min-h-[240px] md:col-span-3 md:row-span-2 lg:col-span-2`}>
          <h3 className={h3}>Pedidos dos tutores</h3>
          <p className={desc}>Agendamentos e reservas de produtos feitos pelo app chegam no painel.</p>
          <div className="absolute inset-x-7 bottom-[26px] flex flex-wrap gap-2">
            {["Reserva: ração 10 kg", "Novo: banho do Max · sáb, 9h"].map((c) => (
              <span key={c} className="rounded-full bg-white px-3 py-[7px] text-[13px] font-semibold">
                {c}
              </span>
            ))}
          </div>
        </article>

        <article className={`${card} flex flex-col gap-4 md:col-span-6 md:flex-row md:items-center md:gap-7`}>
          <h3 className={h3}>Cada um com seu painel</h3>
          <div className="flex flex-wrap gap-2">
            {["Dono: do caixa à visão geral", "Colaboradores: a agenda do dia", "Entregador: a rota"].map((c) => (
              <span key={c} className="rounded-full bg-white px-3 py-[7px] text-[13px] font-semibold">
                {c}
              </span>
            ))}
          </div>
        </article>
      </div>
      <p className="mt-3 text-xs font-medium text-[#5d6873]">Valores e nomes de exemplo. Vídeos: cenas ilustrativas.</p>
    </section>
  );
}
