import { NextResponse } from "next/server";
import { getCameraJwks } from "@/lib/camera/jwt";

// JWKS público consumido pelos MediaMTX dos petshops (authJWTJWKS) para
// validar os tokens de leitura/controle assinados pelos apps.
export async function GET() {
  try {
    return NextResponse.json(await getCameraJwks(), {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({ keys: [] }, { status: 500 });
  }
}
