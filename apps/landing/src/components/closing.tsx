import { LOGIN_URL, SIGNUP_URL, TUTOR_URL } from "@/content/links";
import { WRAP } from "./layout";
import { Guarantees, SignupForm } from "./signup-form";

export function Closing() {
  return (
    <>
      <section className={`${WRAP} pt-24 lg:pt-32`} aria-labelledby="fechamento">
        <div className="on-dark grid gap-8 rounded-3xl bg-graphite p-7 text-white sm:p-10 lg:grid-cols-[1fr_470px] lg:items-center lg:gap-12 lg:p-14">
          <h2 id="fechamento" className="font-heading text-[clamp(2rem,3.6vw,2.75rem)] font-extrabold leading-[1.06] tracking-[-0.03em] [text-wrap:balance]">
            Monte o quadro de hoje. <span className="text-orange">O tutor agradece amanhã.</span>
          </h2>
          <div>
            <SignupForm id="petshop-fim" onDark />
            <Guarantees items={["Cadastro pelo site", "Funciona sem câmera"]} onDark />
          </div>
        </div>
      </section>

      <footer className={`${WRAP} pb-10 pt-16 lg:pt-[72px]`}>
        <div className="grid gap-10 border-t border-[#e6eaee] pt-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-12">
          <div>
            <div className="flex items-center gap-3 text-graphite">
              <img src="/brand/faviconpet.svg" alt="" className="h-11 w-auto" />
              <span className="leading-none">
                <b className="block font-heading text-[22px] font-extrabold tracking-[-0.01em]">
                  Pet Live <span className="title-accent">Pro</span>
                </b>
                <small className="mt-1.5 block text-[13px] font-medium text-[#5d6873]">Transparência e cuidado</small>
              </span>
            </div>
            <p className="mt-3.5 max-w-[320px] text-[15px] leading-relaxed text-[#5d6873]">
              O sistema do petshop e o app em que o tutor acompanha o pet.
            </p>
          </div>
          <FooterCol
            title="Produto"
            links={[
              ["Recursos", "#recursos"],
              ["Câmera ao vivo", "#ao-vivo"],
              ["Preços", "#precos"],
              ["Dúvidas", "#duvidas"],
            ]}
          />
          <FooterCol
            title="Petshop"
            links={[
              ["Criar conta", SIGNUP_URL],
              ["Entrar no painel", LOGIN_URL],
            ]}
          />
          <FooterCol
            title="Tutor"
            links={[
              ["Área do tutor", TUTOR_URL],
              ["Como funciona a câmera", "#ao-vivo"],
            ]}
          />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[#e6eaee] pt-6 text-[13px] font-medium text-[#5d6873] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Pet Live Pro · petlivepro.com.br</span>
          <span>Fotos: Unsplash · Vídeos: Pexels</span>
        </div>
      </footer>
    </>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <nav aria-label={title}>
      <b className="mb-4 block font-heading text-[13px] font-bold uppercase tracking-[0.1em] text-graphite">{title}</b>
      {links.map(([label, href]) => (
        <a key={label} href={href} className="block py-1.5 text-[15px] font-medium text-[#5d6873] hover:text-graphite">
          {label}
        </a>
      ))}
    </nav>
  );
}
