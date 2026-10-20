import { NextResponse } from "next/server";
import { dispatchStalePush } from "@mylivepet/notifications";
import { createAdminClient, envVar } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Expira reservas vencidas e repõe o estoque atomicamente. */
export async function GET(request: Request) {
  const secret = envVar("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("expire_product_reservations");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  // A reserva expirada avisa o tutor (gatilho 0044): sem isto o push só sairia
  // na próxima ação daquele petshop.
  await dispatchStalePush(admin, 0);

  return NextResponse.json({ ok: true, expired: data ?? 0 });
}
