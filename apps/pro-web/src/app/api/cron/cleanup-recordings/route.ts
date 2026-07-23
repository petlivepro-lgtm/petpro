import { NextResponse } from "next/server";
import { createAdminClient, envVar } from "@/lib/supabase/admin";

const BUCKET = "recordings";

// Limpeza diária das gravações vencidas (Vercel Cron — ver vercel.json).
// Remove o arquivo do Storage e a linha de `recording`; a lista do tutor
// esvazia sozinha. Autenticado pelo CRON_SECRET (header enviado pela Vercel).
export async function GET(request: Request) {
  const secret = envVar("CRON_SECRET");
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let removed = 0;

  // Lotes de 200 até esgotar as vencidas (limite de tempo do handler à parte).
  for (let batch = 0; batch < 20; batch++) {
    const { data: expired, error } = await admin
      .from("recording")
      .select("id, storage_path")
      .lt("retain_until", now)
      .limit(200);
    if (error) return NextResponse.json({ error: error.message, removed }, { status: 500 });
    if (!expired || expired.length === 0) break;

    const { error: storageError } = await admin.storage
      .from(BUCKET)
      .remove(expired.map((r) => r.storage_path));
    // "not found" no Storage não impede a limpeza da linha; outros erros sim.
    if (storageError && !/not.*found/i.test(storageError.message)) {
      return NextResponse.json({ error: storageError.message, removed }, { status: 500 });
    }

    const { error: deleteError } = await admin
      .from("recording")
      .delete()
      .in("id", expired.map((r) => r.id));
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message, removed }, { status: 500 });
    }
    removed += expired.length;
  }

  return NextResponse.json({ ok: true, removed });
}
