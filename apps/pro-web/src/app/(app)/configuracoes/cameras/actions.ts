"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { cameraInput, RECORDING_RETENTION_OPTIONS } from "@mylivepet/types";
import { encryptCameraPassword, generateGatewayToken, sha256Hex } from "@/lib/camera/crypto";
import { pingGateway, testCameraConnection } from "@/lib/camera/mediamtx";

export type FormState = { ok: boolean; error?: string };
/** saveGateway devolve o token do uploader UMA única vez (só o hash persiste). */
export type GatewayFormState = FormState & { token?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function parse(formData: FormData) {
  return cameraInput.safeParse({
    room_label: str(formData.get("room_label")),
    host: str(formData.get("host")),
    port: Number(str(formData.get("port")) ?? 554),
    stream_path: str(formData.get("stream_path")) ?? "stream1",
    username: str(formData.get("username")),
    password: str(formData.get("password")),
    active: formData.get("active") === "on",
  });
}

export async function upsertCamera(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  const parsed = parse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  // Na criação a senha é obrigatória; na edição, vazio mantém a atual.
  if (!id && !parsed.data.password) {
    return { ok: false, error: "Informe a senha da Conta da Câmera" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const row = {
    room_label: parsed.data.room_label,
    host: parsed.data.host,
    port: parsed.data.port,
    stream_path: parsed.data.stream_path,
    username: parsed.data.username,
    active: parsed.data.active ?? true,
  };

  let cameraId = id;
  if (id) {
    const { error } = await supabase.from("camera").update(row).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("camera")
      .insert({ tenant_id: tenant.tenantId, ...row })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Erro ao salvar" };
    cameraId = data.id;
  }

  // A senha vai cifrada para camera_credential (sem policies) — só via service role.
  if (parsed.data.password && cameraId) {
    const admin = createAdminClient();
    const { error } = await admin.from("camera_credential").upsert({
      camera_id: cameraId,
      tenant_id: tenant.tenantId,
      password_enc: encryptCameraPassword(parsed.data.password),
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/configuracoes/cameras");
  return { ok: true };
}

export async function deleteCamera(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Câmera inválida" };

  const supabase = await createClient();
  const { error } = await supabase.from("camera").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/cameras");
  return { ok: true };
}

export async function testCamera(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Câmera inválida" };

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const result = await testCameraConnection(tenant.tenantId, id);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/**
 * Salva o gateway do petshop (URLs do Cloudflare Tunnel) e gera um novo token
 * do uploader. O token é retornado UMA vez para o staff colar no `.env` do
 * gateway; no banco fica apenas o hash. Salvar de novo rotaciona o token.
 */
export async function saveGateway(
  _prev: GatewayFormState,
  formData: FormData,
): Promise<GatewayFormState> {
  const tunnelUrl = str(formData.get("tunnel_url"));
  const apiTunnelUrl = str(formData.get("api_tunnel_url"));
  // Em produção exigimos https:// (tunnel). Em dev liberamos http:// para
  // testar o gateway local (ex.: http://192.168.x.x:8889).
  const allowHttp = process.env.NODE_ENV !== "production";
  const isValid = (u?: string) =>
    u?.startsWith("https://") || (allowHttp && u?.startsWith("http://"));
  if (!isValid(tunnelUrl) || !isValid(apiTunnelUrl)) {
    return {
      ok: false,
      error: allowHttp
        ? "Informe as duas URLs do tunnel (http:// ou https://)"
        : "Informe as duas URLs do tunnel (https://...)",
    };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const token = generateGatewayToken();
  const admin = createAdminClient();
  const { error } = await admin.from("camera_gateway").upsert({
    tenant_id: tenant.tenantId,
    tunnel_url: tunnelUrl.replace(/\/$/, ""),
    api_tunnel_url: apiTunnelUrl.replace(/\/$/, ""),
    upload_token_hash: sha256Hex(token),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/cameras");
  return { ok: true, token };
}

export async function testGateway(_prev: FormState, _formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const admin = createAdminClient();
  const { data: gateway } = await admin
    .from("camera_gateway")
    .select("api_tunnel_url")
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();
  if (!gateway) return { ok: false, error: "Gateway não configurado" };

  const online = await pingGateway(gateway.api_tunnel_url);
  return online
    ? { ok: true }
    : { ok: false, error: "Gateway não respondeu — confira se o Docker está rodando no PC do petshop" };
}

export async function updateRetention(_prev: FormState, formData: FormData): Promise<FormState> {
  const days = Number(str(formData.get("retention_days")));
  if (!RECORDING_RETENTION_OPTIONS.includes(days as (typeof RECORDING_RETENTION_OPTIONS)[number])) {
    return { ok: false, error: "Retenção inválida" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  // Merge no jsonb settings (mesmo padrão de configuracoes/actions.ts).
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant")
    .select("settings")
    .eq("id", tenant.tenantId)
    .maybeSingle();
  const current = (data?.settings as Record<string, unknown> | null) ?? {};
  const { error } = await admin
    .from("tenant")
    .update({ settings: { ...current, recordings_retention_days: days } })
    .eq("id", tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes/cameras");
  return { ok: true };
}
