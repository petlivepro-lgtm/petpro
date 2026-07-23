import { NextResponse } from "next/server";
import { authenticateGateway } from "@/lib/camera/gateway-auth";

const BUCKET = "recordings";

// O uploader do gateway pede aqui uma signed upload URL para cada segmento
// gravado. O vídeo sobe DIRETO para o Supabase Storage (não passa pela
// Vercel, que limita o body a ~4,5MB) e o bucket é privado — reprodução só
// por signed URL de leitura emitida aos donos do atendimento.
export async function POST(request: Request) {
  const auth = await authenticateGateway(request);
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { camera_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const cameraId = body.camera_id;
  if (!cameraId) return NextResponse.json({ error: "camera_id required" }, { status: 400 });

  const { admin, tenantId } = auth;

  // Câmera precisa pertencer ao tenant do token.
  const { data: camera } = await admin
    .from("camera")
    .select("id")
    .eq("id", cameraId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!camera) return NextResponse.json({ error: "unknown camera" }, { status: 404 });

  // Mapeia o segmento para o atendimento: primeiro o IN_PROGRESS da câmera;
  // se o segmento chegar logo após a finalização, cai no mais recente das
  // últimas 24h (não dependemos do relógio do PC do petshop).
  const { data: inProgress } = await admin
    .from("appointment")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("camera_id", cameraId)
    .eq("status", "IN_PROGRESS")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let appointmentId = inProgress?.id;
  if (!appointmentId) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("appointment")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("camera_id", cameraId)
      .gte("started_at", dayAgo)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    appointmentId = recent?.id;
  }
  if (!appointmentId) {
    return NextResponse.json({ error: "no appointment for camera" }, { status: 404 });
  }

  try {
    await admin.storage.createBucket(BUCKET, { public: false });
  } catch {
    // bucket já existe — ignorável.
  }

  const path = `${tenantId}/${appointmentId}/${crypto.randomUUID()}.mp4`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "sign failed" }, { status: 500 });
  }

  return NextResponse.json({
    upload_url: data.signedUrl,
    path,
    appointment_id: appointmentId,
  });
}
