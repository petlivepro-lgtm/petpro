import { Check } from "lucide-react";
import { SIGNUP_URL } from "@/content/links";
import { formatPrice, plans } from "@/content/pricing";
import { SectionTitle, WRAP } from "./layout";

// Larguras das linhas provisórias, para não parecerem todas iguais.
const WIDTHS = [72, 58, 80, 64, 50, 70, 54, 66, 60];

export function Pricing() {
  const anyDraft = plans.some((p) => p.draft || p.priceCents === null || !p.includes.length);
  return (
    <section id="precos" className={`${WRAP} pt-24 lg:pt-32`} aria-labelledby="precos-titulo">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
        <SectionTitle id="precos-titulo" lead="Planos" accent="para o seu petshop." className="text-[clamp(2rem,3.6vw,2.75rem)] leading-[1.08]" />
        <p className="max-w-[440px] text-lg leading-relaxed text-[#5d6873]">
          Compare os dois planos e comece pelo que faz mais sentido para o seu dia a dia.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:mt-12">
        {plans.map((plan) => {
          const dark = plan.highlight;
          return (
            <article
              key={plan.name}
              className={`flex flex-col rounded-3xl p-7 sm:p-9 ${
                dark
                  ? "plan-dark bg-graphite text-white"
                  : "border border-[#e6eaee] bg-white shadow-[0_1px_2px_rgba(31,42,51,.05),0_20px_50px_rgba(31,42,51,.08)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-heading text-[26px] font-extrabold">{plan.name}</h3>
                {plan.draft && (
                  <span
                    className={`rounded-full border border-dashed px-2.5 py-1 text-xs font-semibold ${
                      dark ? "border-[#4a5864] text-[#aab5be]" : "border-[#c9d1d8] text-[#5d6873]"
                    }`}
                  >
                    nome provisório
                  </span>
                )}
              </div>
              <div className="mt-3 h-3.5">
                {plan.description ? (
                  <p className={dark ? "text-[#c9d1d8]" : "text-[#5d6873]"}>{plan.description}</p>
                ) : (
                  <i aria-hidden className="skeleton-line" style={{ width: "78%" }} />
                )}
              </div>

              <div className={`mt-6 flex flex-wrap items-baseline gap-1.5 border-b pb-6 ${dark ? "border-[#33424e]" : "border-[#e6eaee]"}`}>
                <b className="font-accent text-[40px] font-bold tracking-[-0.02em] tabular-nums">
                  {plan.priceCents === null ? "R$ —" : formatPrice(plan.priceCents)}
                </b>
                <span className={dark ? "text-[#aab5be]" : "text-[#5d6873]"}>/mês</span>
                {plan.priceCents === null && (
                  <em
                    className={`ml-auto rounded-full px-[11px] py-[5px] text-[13px] font-semibold not-italic ${
                      dark ? "bg-[#2b3843] text-[#c9d1d8]" : "bg-[#f4f6f8] text-[#5d6873]"
                    }`}
                  >
                    Valor a confirmar
                  </em>
                )}
              </div>

              <ul className="mb-8 mt-6 grid gap-4">
                {plan.includes.length
                  ? plan.includes.map((item) => (
                      <li key={item} className="flex gap-3 text-[15px] leading-snug">
                        <Check aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${dark ? "text-orange" : "title-accent"}`} strokeWidth={3.2} />
                        {item}
                      </li>
                    ))
                  : Array.from({ length: plan.placeholderRows }, (_, i) => (
                      <li key={i} className="flex items-center gap-3" aria-hidden>
                        <Check className={`h-4 w-4 shrink-0 ${dark ? "text-orange" : "title-accent"}`} strokeWidth={3.2} />
                        <i className="skeleton-line" style={{ width: `${WIDTHS[(i + (dark ? 1 : 0)) % WIDTHS.length]}%` }} />
                      </li>
                    ))}
              </ul>

              <a
                href={SIGNUP_URL}
                className={`mt-auto block rounded-xl py-4 text-center text-base font-bold transition-colors ${
                  dark ? "bg-orange text-graphite hover:bg-[#ff7d24]" : "bg-graphite text-white hover:bg-[#2b3a46]"
                }`}
              >
                Criar conta do petshop
              </a>
            </article>
          );
        })}
      </div>
      {anyDraft && <p className="mt-4 text-[13px] font-medium text-[#5d6873]">Planos e valores em definição.</p>}
    </section>
  );
}
