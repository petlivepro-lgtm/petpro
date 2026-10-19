import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { TUTOR_PETSHOP_TOPICS } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";

/** 11987654321 → 5511987654321 (WhatsApp precisa do DDI). */
function waNumber(phone: string | null) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

const SHORTCUTS: Record<string, { href: string; label: string }[]> = {
  SCHEDULE: [
    { href: "/atendimentos", label: "Ver meus agendamentos" },
    { href: "/agendar", label: "Pedir um novo horário" },
  ],
  CARE: [{ href: "/atendimentos", label: "Ver meus atendimentos" }],
  PRODUCTS: [{ href: "/produtos", label: "Ver produtos e reservas" }],
  DELIVERY: [{ href: "/a-caminho", label: "Acompanhar o leva-e-traz" }],
};

/**
 * Assunto do petshop: quem resolve é o petshop. Nada de chamado — o tutor vai
 * direto para o WhatsApp dele, e a plataforma só conta o desvio.
 */
export default async function AjudaPetshopPage({ params }: { params: Promise<{ topico: string }> }) {
  const { topico } = await params;
  const topic = TUTOR_PETSHOP_TOPICS.find((t) => t.value === topico.toUpperCase());
  if (!topic) notFound();

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: tenant }] = await Promise.all([
    supabase.from("tenant").select("settings").eq("id", ctx.tenantId).maybeSingle(),
    supabase.rpc("log_support_deflection", { p_tenant: ctx.tenantId, p_topic: topic.value }),
  ]);
  const phone = ((tenant?.settings ?? {}) as { phone?: string | null }).phone ?? null;
  const wa = waNumber(phone);
  const text = encodeURIComponent(`Olá, ${ctx.tenantName}! Aqui é ${ctx.fullName}. Quero falar sobre: ${topic.label.toLowerCase()}.`);
  const initials = ctx.tenantName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <Link href="/ajuda" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-graphite/70 hover:text-graphite">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Ajuda
      </Link>
      <header className="space-y-1.5">
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Quem resolve isso é o {ctx.tenantName}</h1>
        <p className="text-[15px] leading-relaxed text-graphite/75">
          {topic.label} fica com o petshop. Fale direto com eles — é mais rápido.
        </p>
      </header>

      <section className="space-y-3.5 rounded-2xl border border-graphite/10 bg-surface p-5">
        <div className="flex items-center gap-3">
          {ctx.tenantLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ctx.tenantLogoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <span aria-hidden className="grid h-12 w-12 place-items-center rounded-xl bg-petrol font-heading text-lg font-extrabold text-white">
              {initials}
            </span>
          )}
          <div className="flex flex-col">
            <span className="text-base font-bold text-graphite">{ctx.tenantName}</span>
            {phone && <span className="text-[13px] text-gray-neutral">{phone}</span>}
          </div>
        </div>
        {wa ? (
          <a
            href={`https://wa.me/${wa}?text=${text}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[50px] items-center justify-center gap-2.5 rounded-xl bg-orange text-base font-bold text-white transition-colors hover:bg-orange/90"
          >
            <MessageCircle className="h-5 w-5" aria-hidden /> Conversar no WhatsApp
          </a>
        ) : (
          <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-graphite/80">
            O petshop ainda não cadastrou um telefone no Pet Live Pro. Fale com eles no balcão ou pelo contato que você já tem.
          </p>
        )}
        {phone && (
          <a
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            className="flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-graphite/15 text-[15px] font-semibold text-graphite transition-colors hover:bg-surface-muted"
          >
            <Phone className="h-[18px] w-[18px]" aria-hidden /> Ligar
          </a>
        )}
        {wa && <p className="text-xs text-gray-neutral">A mensagem já abre com o seu nome e o assunto.</p>}
      </section>

      {SHORTCUTS[topic.value] && (
        <ul className="overflow-hidden rounded-2xl border border-graphite/10 bg-surface">
          {SHORTCUTS[topic.value]!.map((s) => (
            <li key={s.href} className="border-b border-graphite/[0.06] last:border-0">
              <Link href={s.href} className="flex min-h-[52px] items-center px-4 text-[15px] text-graphite transition-colors hover:bg-surface-muted">
                {s.label}
                <ChevronRight className="ml-auto h-[18px] w-[18px] text-graphite/30" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-[13px] leading-relaxed text-gray-neutral">
        O Pet Live Pro não vê a agenda nem os valores do petshop. Se aconteceu algo grave,{" "}
        <Link href="/ajuda/novo?assunto=PETSHOP_REPORT" className="font-semibold text-petrol underline-offset-2 hover:underline">
          fale com a plataforma em sigilo
        </Link>
        .
      </p>
    </div>
  );
}
