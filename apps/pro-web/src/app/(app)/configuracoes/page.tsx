import Link from "next/link";
import { ChevronRight, Video } from "lucide-react";
import { Card, PageHeader, TabbedSections } from "@mylivepet/ui";
import {
  behaviorConfigSchema,
  feedbackConfigSchema,
  type BehaviorCategory,
  type FeedbackField,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { SettingsForm, type TenantSettings } from "./settings-form";
import { FeedbackSettingsForm } from "./feedback-settings-form";
import { BehaviorSettingsForm } from "./behavior-settings-form";

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

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Dados do petshop, formulários de avaliação e câmeras."
      />

      <TabbedSections
        sections={[
          {
            id: "petshop",
            label: "Petshop",
            content: <SettingsForm tenant={initial} />,
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
