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
 *
 * O filtro por profile_id é obrigatório: a policy membership_select deixa o
 * staff enxergar as memberships dos colegas, então sem ele a query devolveria
 * o papel de outra pessoa assim que o petshop tiver mais de um membro.
 *
 * Passe userId quando já tiver o usuário em mãos, para poupar o getUser().
 */
export async function getActiveTenant(
  supabase: SupabaseClient<Database>,
  userId?: string,
): Promise<ActiveTenant | null> {
  let profileId = userId;
  if (!profileId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    profileId = user.id;
  }

  const { data, error } = await supabase
    .from("membership")
    .select("role, tenant:tenant_id (id, name, settings)")
    .eq("profile_id", profileId)
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
