import type { ReactNode } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@mylivepet/ui";

/**
 * Aba de configuração em duas colunas: o formulário ocupa a largura e, em
 * tela larga, a coluna da direita mostra ao vivo o que o tutor vai ver — o
 * espaço que antes ficava vazio passa a responder "e isso aparece onde?".
 * Em tela estreita a prévia desce para baixo do formulário.
 */
export function SettingsSplit({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">{children}</div>
      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6">{aside}</aside>
    </div>
  );
}

/** Moldura de "tela do app do tutor" para as prévias. */
export function PreviewFrame({
  label = "Como o tutor vê",
  hint,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-graphite/5 bg-surface p-4 shadow-card", className)}>
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-neutral">
        <Smartphone className="h-3.5 w-3.5" aria-hidden /> {label}
      </p>
      <div className="rounded-[20px] border border-graphite/10 bg-surface-muted/70 p-3" aria-hidden>
        {children}
      </div>
      {hint && <p className="mt-3 text-xs leading-relaxed text-gray-neutral">{hint}</p>}
    </div>
  );
}

/** Dicas curtas abaixo da prévia. */
export function TipCard({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <div className="rounded-2xl border border-graphite/5 bg-petrol/[0.05] p-4">
      <p className="mb-2 text-sm font-semibold text-petrol">{title}</p>
      <ul className="space-y-1.5 text-[13px] leading-relaxed text-graphite/80">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-petrol/60" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bloco de seção dentro do card do formulário. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-graphite/[0.06] px-5 py-5 last:border-b-0 sm:px-6">
      <div>
        <h3 className="font-heading text-base font-semibold text-graphite">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-gray-neutral">{description}</p>}
      </div>
      {children}
    </section>
  );
}
