import { createPublicKey } from "node:crypto";
import { SignJWT, exportJWK, importPKCS8 } from "jose";
import { envVar } from "@/lib/supabase/admin";

// Tokens de acesso ao MediaMTX do petshop (RS256).
// O MediaMTX valida via JWKS (authJWTJWKS → GET /api/camera/jwks deste app),
// lendo as permissões da claim `mediamtx_permissions`. A chave privada só
// existe no ambiente do pro-web/tutor-pwa (Vercel) — o gateway nunca a vê.

export type MediaMtxPermission = {
  action: "read" | "publish" | "playback" | "api";
  /** Path do stream (ex.: `cam-<cameraId>`); omitido para action "api". */
  path?: string;
};

function privateKeyPem(): string {
  const pem = envVar("CAMERA_JWT_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("CAMERA_JWT_PRIVATE_KEY ausente no ambiente");
  return pem;
}

function keyId(): string {
  return envVar("CAMERA_JWT_KID") ?? "mylivepet-camera-1";
}

export async function signCameraJwt(
  permissions: MediaMtxPermission[],
  ttlSeconds: number,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem(), "RS256");
  return new SignJWT({ mediamtx_permissions: permissions })
    .setProtectedHeader({ alg: "RS256", kid: keyId() })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}

/** JWKS público servido em /api/camera/jwks para o MediaMTX validar tokens. */
export async function getCameraJwks(): Promise<{ keys: Record<string, unknown>[] }> {
  const jwk = await exportJWK(createPublicKey(privateKeyPem()));
  return { keys: [{ ...jwk, alg: "RS256", use: "sig", kid: keyId() }] };
}
