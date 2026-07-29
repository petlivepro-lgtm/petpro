import { NextResponse } from "next/server";
import { createAdminClient, envVar } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Expira reservas vencidas e repõe o estoque atomicamente. */
export async function GET(request: Request) {
  const secret = envVar("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await createAdminClient().rpc(
    "expire_product_reservations",
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
