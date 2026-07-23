import { NextResponse } from "next/server";
import { DEFAULT_RECORDING_RETENTION_DAYS } from "@mylivepet/types";
import { authenticateGateway } from "@/lib/camera/gateway-auth";

// Após subir o segmento, o uploader confirma aqui e a gravação entra em
// `recording` com o prazo de retenção do tenant — é isso que faz o vídeo
// aparecer na lista do tutor (RLS recording_tutor_select).
export async function POST(request: Request) {
  const auth = await authenticateGateway(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    path?: string;
    camera_id?: string;
    appointment_id?: string;
    started_at?: string;
    ended_at?: string;
    duration_sec?: number;
    size_bytes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.path || !body.appointment_id) {
    return NextResponse.json({ error: "path and appointment_id required" }, { status: 400 });
  }

  const { admin, tenantId } = auth;

  // O path assinado em /sign é `tenantId/appointmentId/...` — reconfere o dono.
  if (!body.path.startsWith(`${tenantId}/${body.appointment_id}/`)) {
    return NextResponse.json({ error: "path mismatch" }, { status: 403 });
  }

  const { data: tenantRow } = await admin
    .from("tenant")
    .select("settings")
    .eq("id", tenantId)
    .maybeSingle();
  const settings = (tenantRow?.settings ?? {}) as { recordings_retention_days?: number };
  const retentionDays = settings.recordings_retention_days ?? DEFAULT_RECORDING_RETENTION_DAYS;
  const retainUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("recording").insert({
    tenant_id: tenantId,
    appointment_id: body.appointment_id,
    camera_id: body.camera_id ?? null,
    storage_path: body.path,
    duration_sec: body.duration_sec ?? null,
    started_at: body.started_at ?? null,
    ended_at: body.ended_at ?? null,
    size_bytes: body.size_bytes ?? null,
    retain_until: retainUntil,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, retain_until: retainUntil });
}
