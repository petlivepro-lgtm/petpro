import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CreditCard, Crown, Video } from "lucide-react";
import { PageHeader, TabbedSections } from "@mylivepet/ui";
import {
  hasAddress,
  type AddressParts,
  behaviorConfigSchema,
  feedbackConfigSchema,
  type BehaviorCategory,
  type FeedbackField,
  type ServiceStepTemplate,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { SettingsForm, type TenantSettings } from "./settings-form";
import { FeedbackSettingsForm } from "./feedback-settings-form";
import { BehaviorSettingsForm } from "./behavior-settings-form";
import { StepLibraryForm } from "./step-library-form";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return null;

  const { data } = await supabase
    .from("tenant")
    .select("name, settings")
    .eq("id", tenant.tenantId)
    .maybeSingle();

  const settings = (data?.settings ?? {}) as {
    logo_path?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    address_parts?: AddressParts | null;
    feedback?: unknown;
    behavior?: unknown;
  };

  const initial: TenantSettings = {
    name: data?.name ?? tenant.tenantName,
    logoUrl: settings.logo_path ?? null,
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    addressParts: hasAddress(settings.address_parts) ? settings.address_parts! : null,
    legacyAddress: settings.address?.trim() || null,
  };

  const feedbackParsed = feedbackConfigSchema.safeParse(settings.feedback);
  const feedbackFields: FeedbackField[] = feedbackParsed.success
    ? feedbackParsed.data.fields
    : [];

  const behaviorParsed = behaviorConfigSchema.safeParse(settings.behavior);
  const behaviorCategories: BehaviorCategory[] = behaviorParsed.success
    ? behaviorParsed.data.categories
    : [];

  // Biblioteca de etapas + quem usa cada uma, para o form avisar antes de remover
  // uma etapa que está no checklist de algum serviço.
  const count = (n: number | null, one: string, many: string, none: string) =>
    !n ? none : `${n} ${n === 1 ? one : many}`;
  const [{ data: stepRows }, { data: serviceRows }, plans, terminals, cameras] = await Promise.all([
    supabase
      .from("service_step_template")
      .select("id, label")
      .eq("tenant_id", tenant.tenantId)
      .order("position"),
    supabase
      .from("service_type")
      .select("name, step_ids")
      .eq("tenant_id", tenant.tenantId)
      .order("name"),
    // Só o resumo das abas que levam para outra página.
    supabase.from("clubinho_plan").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("active", true),
    supabase.from("payment_terminal").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("active", true),
    supabase.from("camera").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.tenantId).eq("active", true),
  ]);

  const stepUsage: Record<string, string[]> = {};
  for (const service of serviceRows ?? []) {
    for (const stepId of service.step_ids ?? []) {
      (stepUsage[stepId] ??= []).push(service.name);
    }
  }

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Dados do petshop, etapas do atendimento, formulários de avaliação, planos do Clubinho, maquininhas e câmeras."
      />

      <TabbedSections
        sections={[
          {
            id: "petshop",
            label: "Petshop",
            content: <SettingsForm tenant={initial} />,
          },
          {
            id: "etapas",
            label: "Etapas",
            content: (
              <StepLibraryForm
                steps={(stepRows ?? []) as ServiceStepTemplate[]}
                usage={stepUsage}
              />
            ),
          },
          {
            id: "boletim",
            label: "Boletim do pet",
            content: <BehaviorSettingsForm categories={behaviorCategories} />,
          },
          {
            id: "avaliacao",
            label: "Avaliação do tutor",
            content: <FeedbackSettingsForm fields={feedbackFields} />,
          },
          {
            id: "clubinho",
            label: "Clubinho",
            content: (
              <SectionLink
                href="/configuracoes/clubinho"
                icon={<Crown className="h-6 w-6" />}
                title="Planos do Clubinho"
                description="Pacotes recorrentes de serviços: valor, de quanto em quanto tempo renovam e quantos banhos entregam por ciclo."
                summary={count(plans.count, "plano ativo", "planos ativos", "Nenhum plano ativo")}
                cta="Gerenciar planos"
              />
            ),
          },
          {
            id: "maquininhas",
            label: "Maquininhas",
            content: (
              <SectionLink
                href="/configuracoes/pagamentos"
                icon={<CreditCard className="h-6 w-6" />}
                title="Maquininhas e taxas"
                description="Quanto a operadora retém em cada forma de pagamento, com o líquido refletido no financeiro."
                summary={count(terminals.count, "maquininha ativa", "maquininhas ativas", "Nenhuma maquininha cadastrada")}
                cta="Gerenciar maquininhas"
              />
            ),
          },
          {
            id: "cameras",
            label: "Câmeras",
            content: (
              <SectionLink
                href="/configuracoes/cameras"
                icon={<Video className="h-6 w-6" />}
                title="Câmeras"
                description="Transmissão ao vivo do atendimento para o tutor e gravações."
                summary={count(cameras.count, "câmera ativa", "câmeras ativas", "Nenhuma câmera ativa")}
                cta="Gerenciar câmeras"
              />
            ),
          },
        ]}
      />
    </>
  );
}

/**
 * Aba que não tem formulário próprio: leva para a sub-rota da seção. Ocupa a
 * largura toda e diz o que já está configurado, para a aba não ser só um link
 * perdido num canto da tela.
 */
function SectionLink({
  href,
  icon,
  title,
  description,
  summary,
  cta,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  summary: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-2xl border border-graphite/5 bg-surface p-5 shadow-card transition-colors hover:border-orange/40 sm:flex-row sm:items-center sm:p-6"
    >
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange/10 text-orange">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-lg font-semibold text-graphite">{title}</p>
        <p className="mt-0.5 text-sm text-gray-neutral">{description}</p>
        <p className="mt-2 inline-flex rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-graphite/80">{summary}</p>
      </div>
      <span className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-orange px-5 text-sm font-medium text-white transition-colors group-hover:bg-orange/90 sm:self-center">
        {cta} <ArrowRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}
