"use server";

import { CAMERA_CONSENT_PURPOSE } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTutorContext } from "@/lib/tutor-context";
import { signCameraReadJwt } from "@/lib/camera-jwt";

const RECORDINGS_BUCKET = "recordings";
const STREAM_TOKEN_TTL_SECONDS = 15 * 60;
const RECORDING_URL_TTL_SECONDS = 60 * 60;
/**
 * Quantas partes o player assina de uma vez. O link vale 1h, então pré-assinar
 * o atendimento inteiro faria as últimas partes vencerem antes de tocar — o
 * player pede a parte atual e a seguinte, e renova conforme avança.
 */
const MAX_SIGNED_PARTS = 4;

export type LiveStreamState =
  | { status: "none" } // nenhum atendimento do tutor em andamento com câmera
  | { status: "consent" } // precisa autorizar (LGPD) antes de assistir
  | { status: "offline" } // atendimento ao vivo, mas gateway não configurado
  | {
      status: "live";
      appointmentId: string;
      petName: string;
      serviceName: string;
      roomLabel: string | null;
      whepUrl: string;
      hlsUrl: string;
      /** etapas do checklist já renderizadas no server (seguem em tempo real) */
      steps: LiveStep[];
      /** epoch ms para renovar o token antes de expirar */
      refreshAt: number;
    };

export type LiveStep = {
  id: string;
  label: string;
  position: number;
  done: boolean;
  done_at: string | null;
};

/**
 * Resolve o stream ao vivo do tutor logado. A RLS de appointment garante que
 * só os atendimentos DELE aparecem; o token de leitura sai escopado ao path
 * da câmera e expira em minutos — outro tutor nunca recebe token deste path.
 */
export async function getLiveStream(): Promise<LiveStreamState> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { status: "none" };

  const { data: appt } = await supabase
    .from("appointment")
    .select("id, camera_id, pet:pet_id(name), service_type(name), camera:camera_id(room_label)")
    .eq("tutor_id", ctx.tutorId)
    .eq("status", "IN_PROGRESS")
    .not("camera_id", "is", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!appt?.camera_id) return { status: "none" };

  const { data: consent } = await supabase
    .from("consent")
    .select("granted")
    .eq("tutor_id", ctx.tutorId)
    .eq("purpose", CAMERA_CONSENT_PURPOSE)
    .limit(1)
    .maybeSingle();
  if (!consent?.granted) return { status: "consent" };

  // Gateway do tenant (tabela sem policies — leitura via service role).
  const admin = createAdminClient();
  const { data: gateway } = await admin
    .from("camera_gateway")
    .select("tunnel_url")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!gateway) return { status: "offline" };

  // Checklist do atendimento (RLS step_tutor_select: só os passos do tutor).
  const { data: steps } = await supabase
    .from("appointment_step")
    .select("id, label, position, done, done_at")
    .eq("appointment_id", appt.id)
    .order("position", { ascending: true });

  const path = `cam-${appt.camera_id}`;
  const jwt = await signCameraReadJwt(path, STREAM_TOKEN_TTL_SECONDS);
  const base = gateway.tunnel_url.replace(/\/$/, "");
  const pet = appt.pet as unknown as { name: string } | null;
  const service = appt.service_type as unknown as { name: string } | null;
  const camera = appt.camera as unknown as { room_label: string } | null;

  return {
    status: "live",
    appointmentId: appt.id,
    petName: pet?.name ?? "Seu pet",
    serviceName: service?.name ?? "Atendimento",
    roomLabel: camera?.room_label ?? null,
    whepUrl: `${base}/${path}/whep?jwt=${jwt}`,
    hlsUrl: `${base}/${path}/index.m3u8?jwt=${jwt}`,
    steps: steps ?? [],
    refreshAt: Date.now() + (STREAM_TOKEN_TTL_SECONDS - 60) * 1000,
  };
}

/** Registra o consentimento LGPD do tutor para a câmera (cria ou atualiza). */
export async function grantCameraConsent(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { ok: false, error: "Sessão inválida" };

  const { data: existing } = await supabase
    .from("consent")
    .select("id")
    .eq("tutor_id", ctx.tutorId)
    .eq("purpose", CAMERA_CONSENT_PURPOSE)
    .limit(1)
    .maybeSingle();

  const grantedAt = new Date().toISOString();
  const { error } = existing
    ? await supabase
        .from("consent")
        .update({ granted: true, granted_at: grantedAt })
        .eq("id", existing.id)
    : await supabase.from("consent").insert({
        tenant_id: ctx.tenantId,
        tutor_id: ctx.tutorId,
        purpose: CAMERA_CONSENT_PURPOSE,
        granted: true,
        granted_at: grantedAt,
      });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * URL assinada (1h) para assistir a uma gravação. A posse é validada pela RLS
 * (recording_tutor_select) e o acesso fica no audit_log ("recording.view").
 */
export async function getRecordingUrls(
  recordingIds: string[],
): Promise<{ urls?: Record<string, string>; error?: string }> {
  if (recordingIds.length === 0) return { urls: {} };
  const ids = recordingIds.slice(0, MAX_SIGNED_PARTS);

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { error: "Sessão inválida" };

  // Consulta com o client do usuário: a RLS só devolve gravações dos
  // atendimentos do próprio tutor.
  const { data: recordings } = await supabase
    .from("recording")
    .select("id, storage_path, retain_until")
    .in("id", ids);
  if (!recordings?.length) return { error: "Gravação não encontrada" };

  const now = new Date();
  const live = recordings.filter((r) => !r.retain_until || new Date(r.retain_until) >= now);
  if (live.length === 0) return { error: "Gravação expirada" };

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrls(
      live.map((r) => r.storage_path),
      RECORDING_URL_TTL_SECONDS,
    );
  if (error || !data) return { error: "Não foi possível gerar o link" };

  const idByPath = new Map(live.map((r) => [r.storage_path, r.id]));
  const urls: Record<string, string> = {};
  for (const signed of data) {
    const id = signed.path ? idByPath.get(signed.path) : undefined;
    if (id && signed.signedUrl) urls[id] = signed.signedUrl;
  }
  if (Object.keys(urls).length === 0) return { error: "Não foi possível gerar o link" };

  return { urls };
}

/**
 * Registra que o tutor assistiu esta parte. Fica fora de `getRecordingUrls` de
 * propósito: o player pré-assina a parte seguinte para emendar sem engasgo, e
 * a trilha de auditoria precisa dizer o que foi visto — não o que foi
 * carregado por precaução.
 */
export async function logRecordingView(recordingId: string): Promise<void> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return;

  // Confere pela RLS que a gravação é mesmo de um atendimento deste tutor
  // antes de escrever com o service role.
  const { data: recording } = await supabase
    .from("recording")
    .select("id")
    .eq("id", recordingId)
    .maybeSingle();
  if (!recording) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  await createAdminClient().from("audit_log").insert({
    tenant_id: ctx.tenantId,
    actor_id: user?.id ?? null,
    action: "recording.view",
    target: `recording:${recording.id}`,
  });
}
