import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { envVar, requiredEnv } from "@/lib/env";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Hash com segredo para IP e e-mail em logs de tentativa/auditoria. Um sha256
 * puro de IPv4 se quebra por força bruta em minutos; com HMAC não. O segredo
 * dedicado é opcional — sem ele, deriva da service role key, que já é secreta.
 */
export function privateHash(value: string): string {
  const secret = envVar("ADMIN_HASH_SECRET") ?? requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}

/** Token aleatório para convites (url-safe, 256 bits). */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export async function requestMeta() {
  const h = await headers();
  // Na Vercel, x-forwarded-for é definido pela própria plataforma.
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
  const userAgent = (h.get("user-agent") ?? "").slice(0, 300) || null;
  return { ip, ipHash: privateHash(ip), userAgent };
}

export type JwtClaims = {
  sub?: string;
  session_id?: string;
  aal?: string;
  iat?: number;
  exp?: number;
};

/**
 * Lê os claims de um access token. NÃO valida assinatura — só use depois de
 * `auth.getUser()` ter validado o mesmo token no servidor do Supabase.
 */
export function readJwtClaims(token: string): JwtClaims {
  const payload = token.split(".")[1];
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtClaims;
  } catch {
    return {};
  }
}
