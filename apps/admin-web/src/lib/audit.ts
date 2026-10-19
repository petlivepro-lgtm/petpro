import "server-only";
import { serviceClient } from "@/lib/supabase/service";
import { requestMeta } from "@/lib/security";

export type AuditEvent = {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  tenantId?: string | null;
  reason?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
};

/**
 * Registra na trilha append-only. LANÇA se não conseguir: ação sensível que
 * não deixou rastro não acontece (quem chama audita ANTES de executar quando
 * o efeito é revelar algo, como um dado pessoal).
 */
export async function writeAudit(event: AuditEvent) {
  const { ipHash } = await requestMeta();
  const { error } = await serviceClient()
    .from("platform_admin_audit")
    .insert({
      actor_id: event.actorId,
      actor_email: event.actorEmail ?? null,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId ?? null,
      tenant_id: event.tenantId ?? null,
      reason: event.reason?.trim() || null,
      before_data: event.beforeData ?? null,
      after_data: event.afterData ?? null,
      ip_hash: ipHash,
    });
  if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`);
}
