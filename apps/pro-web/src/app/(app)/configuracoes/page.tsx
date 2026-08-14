import Link from "next/link";
import { ChevronRight, Video } from "lucide-react";
import { Card, PageHeader, TabbedSections } from "@mylivepet/ui";
import {
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
    feedback?: unknown;
    behavior?: unknown;
  };

  const initial: TenantSettings = {
    name: data?.name ?? tenant.tenantName,
    logoUrl: settings.logo_path ?? null,
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    address: settings.address ?? "",
  };

  const feedbackParsed = feedbackConfigSchema.safeParse(settings.feedback);
  const feedbackFields: FeedbackField[] = feedbackParsed.success ? feedbackParsed.data.fields : [];

  const behaviorParsed = behaviorConfigSchema.safeParse(settings.behavior);
  const behaviorCategories: BehaviorCategory[] = behaviorParsed.success
    ? behaviorParsed.data.categories
    : [];

  // Biblioteca de etapas + quem usa cada uma, para o form avisar antes de remover
  // uma etapa que está no checklist de algum serviço.
  const [{ data: stepRows }, { data: serviceRows }] = await Promise.all([
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
        subtitle="Dados do petshop, etapas do atendimento, formulários de avaliação e câmeras."
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
            id: "cameras",
            label: "Câmeras",
            content: (
              <Link href="/configuracoes/cameras" className="block max-w-3xl">
                <Card className="flex items-center justify-between transition-colors hover:border-orange/40">
                  <div className="flex items-center gap-3">
                    <Video className="h-5 w-5 text-orange" />
                    <div>
                      <p className="font-heading font-semibold text-graphite">
                        Câmeras
                      </p>
                      <p className="text-sm text-gray-neutral">
                        Transmissão ao vivo do atendimento para o tutor e
                        gravações.
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-neutral" />
                </Card>
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
