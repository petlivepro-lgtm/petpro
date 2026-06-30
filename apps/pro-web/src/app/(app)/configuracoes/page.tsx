import { PageHeader } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { SettingsForm, type TenantSettings } from "./settings-form";

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
  };

  const initial: TenantSettings = {
    name: data?.name ?? tenant.tenantName,
    logoUrl: settings.logo_path ?? null,
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    address: settings.address ?? "",
  };

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Edite o nome, os dados de contato e a logo do seu petshop."
      />
      <SettingsForm tenant={initial} />
    </>
  );
}
