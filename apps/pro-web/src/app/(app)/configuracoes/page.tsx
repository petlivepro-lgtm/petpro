import { PageHeader } from "@mylivepet/ui";
import { feedbackConfigSchema, type FeedbackField } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { SettingsForm, type TenantSettings } from "./settings-form";
import { FeedbackSettingsForm } from "./feedback-settings-form";

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

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Edite o nome, os dados de contato e a logo do seu petshop."
      />
      <div className="space-y-6">
        <SettingsForm tenant={initial} />
        <FeedbackSettingsForm fields={feedbackFields} />
      </div>
    </>
  );
}
