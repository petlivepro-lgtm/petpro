import { SignJWT, importPKCS8 } from "jose";
import { envVar } from "@/lib/supabase/admin";

// Token de LEITURA do stream, assinado só depois de validar que o tutor é o
// dono do atendimento IN_PROGRESS. O MediaMTX do petshop valida via JWKS
// (servido pelo pro-web em /api/camera/jwks) e o escopo é 1 path por token —
// mesma chave privada (CAMERA_JWT_PRIVATE_KEY) compartilhada entre os apps.

export async function signCameraReadJwt(path: string, ttlSeconds: number): Promise<string> {
  const pem = envVar("CAMERA_JWT_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("CAMERA_JWT_PRIVATE_KEY ausente no ambiente do tutor-pwa");
  const key = await importPKCS8(pem, "RS256");
  return new SignJWT({ mediamtx_permissions: [{ action: "read", path }] })
    .setProtectedHeader({ alg: "RS256", kid: envVar("CAMERA_JWT_KID") ?? "mylivepet-camera-1" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}
