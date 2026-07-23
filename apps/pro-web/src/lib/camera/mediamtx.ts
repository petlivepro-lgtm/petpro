import { createAdminClient } from "@/lib/supabase/admin";
import { decryptCameraPassword } from "./crypto";
import { signCameraJwt } from "./jwt";

// Cliente da API de controle do MediaMTX do petshop (via Cloudflare Tunnel).
// O path do stream só existe enquanto o atendimento está IN_PROGRESS:
// startAppointment cria (`/v3/config/paths/add`), finishAppointment remove.
// Sem path, nem um token de leitura ainda válido encontra o que assistir.

export type GatewayResult = { ok: true } | { ok: false; error: string };

export function cameraPathName(cameraId: string): string {
  return `cam-${cameraId}`;
}

async function gatewayFetch(
  apiTunnelUrl: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const jwt = await signCameraJwt([{ action: "api" }], 60);
  return fetch(`${apiTunnelUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
}

type CameraConnection = {
  apiTunnelUrl: string;
  source: string;
};

/** Monta a URL RTSP da câmera decifrando a senha — nunca sai do servidor. */
async function resolveConnection(
  tenantId: string,
  cameraId: string,
): Promise<CameraConnection | { error: string }> {
  const admin = createAdminClient();
  const [{ data: camera }, { data: credential }, { data: gateway }] = await Promise.all([
    admin
      .from("camera")
      .select("id, host, port, stream_path, username")
      .eq("id", cameraId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("camera_credential")
      .select("password_enc")
      .eq("camera_id", cameraId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    admin
      .from("camera_gateway")
      .select("api_tunnel_url")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
  ]);

  if (!camera?.host || !camera.username) return { error: "Câmera sem dados de conexão" };
  if (!credential) return { error: "Câmera sem credencial cadastrada" };
  if (!gateway) return { error: "Gateway de câmeras não configurado" };

  const password = decryptCameraPassword(credential.password_enc);
  const auth = `${encodeURIComponent(camera.username)}:${encodeURIComponent(password)}`;
  return {
    apiTunnelUrl: gateway.api_tunnel_url,
    source: `rtsp://${auth}@${camera.host}:${camera.port}/${camera.stream_path}`,
  };
}

/** Cria (ou atualiza) o path da câmera no MediaMTX — liga stream + gravação. */
export async function startCameraStream(
  tenantId: string,
  cameraId: string,
): Promise<GatewayResult> {
  const conn = await resolveConnection(tenantId, cameraId);
  if ("error" in conn) return { ok: false, error: conn.error };

  const name = cameraPathName(cameraId);
  const body = JSON.stringify({
    source: conn.source,
    sourceOnDemand: false,
    rtspTransport: "tcp", // Tapo por UDP perde pacotes com facilidade
    record: true,
  });

  try {
    const added = await gatewayFetch(conn.apiTunnelUrl, `/v3/config/paths/add/${name}`, {
      method: "POST",
      body,
    });
    if (added.ok) return { ok: true };
    // Path já existe (atendimento anterior não removeu) — sobrescreve.
    const patched = await gatewayFetch(conn.apiTunnelUrl, `/v3/config/paths/patch/${name}`, {
      method: "PATCH",
      body,
    });
    if (patched.ok) return { ok: true };
    return { ok: false, error: `Gateway recusou o stream (${patched.status})` };
  } catch {
    return { ok: false, error: "Gateway de câmeras indisponível" };
  }
}

/** Remove o path da câmera — encerra stream e gravação. */
export async function stopCameraStream(
  tenantId: string,
  cameraId: string,
): Promise<GatewayResult> {
  const admin = createAdminClient();
  const { data: gateway } = await admin
    .from("camera_gateway")
    .select("api_tunnel_url")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!gateway) return { ok: false, error: "Gateway de câmeras não configurado" };

  const name = cameraPathName(cameraId);
  try {
    const res = await gatewayFetch(gateway.api_tunnel_url, `/v3/config/paths/delete/${name}`, {
      method: "DELETE",
    });
    // 404 = path já não existe; considera encerrado.
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, error: `Gateway recusou o encerramento (${res.status})` };
  } catch {
    return { ok: false, error: "Gateway de câmeras indisponível" };
  }
}

/**
 * Testa a conexão com a câmera: cria um path temporário, espera o MediaMTX
 * conectar no RTSP (poll de `ready`) e remove o path ao final.
 */
export async function testCameraConnection(
  tenantId: string,
  cameraId: string,
): Promise<GatewayResult> {
  const conn = await resolveConnection(tenantId, cameraId);
  if ("error" in conn) return { ok: false, error: conn.error };

  const name = `test-${cameraId}`;
  try {
    const added = await gatewayFetch(conn.apiTunnelUrl, `/v3/config/paths/add/${name}`, {
      method: "POST",
      body: JSON.stringify({
        source: conn.source,
        sourceOnDemand: false,
        rtspTransport: "tcp",
        record: false,
      }),
    });
    if (!added.ok) return { ok: false, error: `Gateway recusou o teste (${added.status})` };

    let ready = false;
    for (let i = 0; i < 5 && !ready; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await gatewayFetch(conn.apiTunnelUrl, `/v3/paths/get/${name}`);
      if (res.ok) {
        const info = (await res.json()) as { ready?: boolean };
        ready = info.ready === true;
      }
    }
    return ready
      ? { ok: true }
      : { ok: false, error: "Gateway online, mas a câmera não respondeu (confira IP e Conta da Câmera)" };
  } catch {
    return { ok: false, error: "Gateway de câmeras indisponível" };
  } finally {
    try {
      await gatewayFetch(conn.apiTunnelUrl, `/v3/config/paths/delete/${name}`, {
        method: "DELETE",
      });
    } catch {
      // gateway caiu no meio do teste — path temporário morre com o processo.
    }
  }
}

/** Ping simples na API do gateway (usado no card de status das configurações). */
export async function pingGateway(apiTunnelUrl: string): Promise<boolean> {
  try {
    const res = await gatewayFetch(apiTunnelUrl, "/v3/config/global/get");
    return res.ok;
  } catch {
    return false;
  }
}
