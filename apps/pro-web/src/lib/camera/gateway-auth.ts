import { createAdminClient } from "@/lib/supabase/admin";
import { sha256Hex } from "./crypto";

// Autenticação dos endpoints chamados pelo uploader do gateway do petshop.
// O gateway guarda apenas um token opaco por tenant (GATEWAY_UPLOAD_TOKEN);
// aqui ele é conferido contra o hash em camera_gateway. Esse token autoriza
// somente pedir signed upload URLs e registrar gravações do próprio tenant.

export type GatewayAuth = {
  tenantId: string;
  admin: ReturnType<typeof createAdminClient>;
};

export async function authenticateGateway(request: Request): Promise<GatewayAuth | null> {
  const header = request.headers.get("authorization");
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("camera_gateway")
    .select("tenant_id")
    .eq("upload_token_hash", sha256Hex(token))
    .maybeSingle();
  if (!data) return null;

  // Marca o gateway como vivo (status no card de configurações).
  await admin
    .from("camera_gateway")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("tenant_id", data.tenant_id);

  return { tenantId: data.tenant_id, admin };
}
