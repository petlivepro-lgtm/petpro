import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { envVar } from "@/lib/supabase/admin";

// Cifra de credenciais de câmera (senha da Conta da Câmera Tapo).
// AES-256-GCM com chave em env (CAMERA_SECRET_KEY, 32 bytes em base64).
// A senha cifrada vive em camera_credential (tabela sem policies — só o
// service role lê) e só é decifrada server-side ao montar a URL RTSP.

function secretKey(): Buffer {
  const b64 = envVar("CAMERA_SECRET_KEY");
  if (!b64) throw new Error("CAMERA_SECRET_KEY ausente no ambiente do pro-web");
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("CAMERA_SECRET_KEY deve ter 32 bytes em base64 (openssl rand -base64 32)");
  }
  return key;
}

/** Cifra a senha. Formato armazenado: `iv.ciphertext.tag` em base64. */
export function encryptCameraPassword(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, encrypted, cipher.getAuthTag()].map((b) => b.toString("base64")).join(".");
}

export function decryptCameraPassword(enc: string): string {
  const [iv, ciphertext, tag] = enc.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Token do uploader do gateway (mostrado UMA vez ao staff; só o hash persiste).
 * Autoriza apenas pedir signed upload URLs e registrar gravações do tenant.
 */
export function generateGatewayToken(): string {
  return `mlp_${randomBytes(24).toString("base64url")}`;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
