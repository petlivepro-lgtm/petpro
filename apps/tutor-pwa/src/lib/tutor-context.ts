import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types";

export type TutorContext = {
  tutorId: string;
  tenantId: string;
  tenantName: string;
  fullName: string;
};

/**
 * Resolve o contexto do tutor logado (primeira ficha de tutor vinculada ao profile).
 * RLS garante que só retornem fichas do próprio usuário.
 */
export async function getTutorContext(
  supabase: SupabaseClient<Database>,
): Promise<TutorContext | null> {
  const { data, error } = await supabase
    .from("tutor")
    .select("id, full_name, tenant:tenant_id (id, name)")
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.tenant) return null;
  const tenant = data.tenant as unknown as { id: string; name: string };
  return {
    tutorId: data.id,
    tenantId: tenant.id,
    tenantName: tenant.name,
    fullName: data.full_name,
  };
}
