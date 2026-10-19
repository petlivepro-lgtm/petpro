import { FileText, KeyRound, Smartphone } from "lucide-react";

const PROMISES = [
  { icon: KeyRound, text: "Sem cadastro: o acesso só nasce por convite de um superadmin." },
  { icon: Smartphone, text: "Verificação em 2 etapas obrigatória, com app autenticador." },
  { icon: FileText, text: "Cada acesso e cada ação ficam registrados na auditoria." },
];

/** Moldura das telas de acesso: painel grafite com a marca + formulário. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      <section className="flex flex-col gap-10 bg-graphite px-6 py-10 text-white sm:px-12 lg:w-[44%] lg:px-14 lg:py-12">
        <img src="/brand/logopet-white.svg" alt="Pet Live Pro" className="h-auto w-40" />
        <div className="flex max-w-md flex-col gap-4 lg:mt-auto">
          <h1 className="text-balance font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Administração da plataforma
          </h1>
          <p className="text-base leading-relaxed text-white/70">
            Daqui se acompanha todos os petshops e tutores do Pet Live Pro. Por isso a porta é estreita.
          </p>
        </div>
        <ul className="flex max-w-md flex-col gap-3.5 lg:mb-auto">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-orange" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <p className="hidden text-xs text-white/50 lg:block">admin.petlivepro.com.br</p>
      </section>
      <section className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">{children}</div>
      </section>
    </div>
  );
}
