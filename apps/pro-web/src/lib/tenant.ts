import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, StaffRole } from "@mylivepet/types";

export type ActiveTenant = {
  tenantId: string;
  tenantName: string;
  role: StaffRole;
  logoUrl: string | null;
};

/**
 * Resolve o tenant ativo do staff logado (primeira membership).
 * MVP: assume um petshop por usuário; evolui para seletor de tenant depois.
 */
export async function getActiveTenant(
  supabase: SupabaseClient<Database>,
): Promise<ActiveTenant | null> {
  const { data, error } = await supabase
    .from("membership")
    .select("role, tenant:tenant_id (id, name, settings)")
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.tenant) return null;

  const tenant = data.tenant as unknown as {
    id: string;
    name: string;
    settings: { logo_path?: string | null } | null;
  };
  const logoUrl =
    tenant.settings && typeof tenant.settings.logo_path === "string"
      ? tenant.settings.logo_path
      : null;
  return { tenantId: tenant.id, tenantName: tenant.name, role: data.role, logoUrl };
}
