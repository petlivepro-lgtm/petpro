"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  behaviorReportInput,
  computeOverallScore,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@mylivepet/types";
import {
  startCameraStream,
  stopCameraStream,
  type GatewayResult,
} from "@/lib/camera/mediamtx";

const BUCKET = "appointment-photos";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Sobe as fotos do atendimento e retorna as URLs públicas. */
async function uploadPhotos(
  tenantId: string,
  appointmentId: string,
  files: File[],
): Promise<string[]> {
  if (files.length === 0) return [];
  const admin = createAdminClient();
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    // bucket já existe — ignorável.
  }
  const urls: string[] = [];
  for (const file of files.slice(0, 5)) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${tenantId}/${appointmentId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error)
      urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

/**
 * Abre a sessão de câmera do atendimento e liga o stream no gateway.
 *
 * A sessão é o histórico das salas por onde o pet passou: sem ela, o segmento
 * gravado na sala anterior não acharia mais o atendimento depois da troca (o
 * uploader só conhece a câmera). Ver 0034_appointment_camera_session.sql.
 */
async function openCameraSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  appointmentId: string,
  cameraId: string,
): Promise<GatewayResult> {
  const { error } = await supabase.from("appointment_camera_session").insert({
    tenant_id: tenantId,
    appointment_id: appointmentId,
    camera_id: cameraId,
    started_at: new Date().toISOString(),
  });
  // Sem sessão o vídeo ainda é gravado — a rota /recordings/sign cai no
  // appointment.camera_id —, mas a troca de sala perde o histórico.
  if (error) console.warn(`[camera] falha ao abrir sessão: ${error.message}`);
  return startCameraStream(tenantId, cameraId);
}

/** Fecha a sessão aberta do atendimento e desliga a câmera, se ninguém mais a usa. */
async function closeCameraSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  appointmentId: string,
  cameraId: string | null,
): Promise<GatewayResult> {
  await supabase
    .from("appointment_camera_session")
    .update({ ended_at: new Date().toISOString() })
    .eq("appointment_id", appointmentId)
    .is("ended_at", null);

  if (!cameraId) return { ok: true };

  // Duas transmissões simultâneas na mesma câmera são permitidas — remover o
  // path do MediaMTX derrubaria o stream do outro atendimento. A contagem vai
  // pelo service role de propósito: a RLS do colaborador só mostra as sessões
  // dos atendimentos dele, e ele leria "câmera livre" com um colega no ar.
  const { count } = await createAdminClient()
    .from("appointment_camera_session")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("camera_id", cameraId)
    .is("ended_at", null);
  if ((count ?? 0) > 0) return { ok: true };

  return stopCameraStream(tenantId, cameraId);
}

/** Inicia o atendimento: CONFIRMED/CHECKED_IN → IN_PROGRESS. */
export async function startAppointment(formData: FormData) {
  const id = str(formData.get("appointment_id"));
  if (!id) return;
  const supabase = await createClient();

  // Semeia o checklist com o fluxo padrão do serviço (uma única vez).
  const { data: appt } = await supabase
    .from("appointment")
    .select("tenant_id, service_type_id")
    .eq("id", id)
    .single();
  if (appt?.service_type_id) {
    const { data: service } = await supabase
      .from("service_type")
      .select("step_ids")
      .eq("id", appt.service_type_id)
      .single();
    const stepIds = service?.step_ids ?? [];
    if (stepIds.length > 0) {
      const { count } = await supabase
        .from("appointment_step")
        .select("id", { count: "exact", head: true })
        .eq("appointment_id", id);
      if ((count ?? 0) === 0) {
        // Resolve id -> rótulo na biblioteca (0035). O label gravado aqui é
        // SNAPSHOT: renomear a etapa depois não mexe neste atendimento.
        const { data: templates } = await supabase
          .from("service_step_template")
          .select("id, label")
          .in("id", stepIds);
        const labelById = new Map((templates ?? []).map((t) => [t.id, t.label]));

        // A ordem vem de stepIds, não da ordem devolvida pelo .in(). Um id sem
        // rótulo é ignorado e a posição é recontada, para o checklist não nascer
        // com um passo em branco nem com buraco na numeração.
        const rows = stepIds
          .map((stepId) => labelById.get(stepId))
          .filter((label): label is string => !!label)
          .map((label, position) => ({
            tenant_id: appt.tenant_id,
            appointment_id: id,
            label,
            position,
            done: false,
            done_at: null,
          }));

        if (rows.length > 0) await supabase.from("appointment_step").insert(rows);
      }
    }
  }

  // Câmera da sala escolhida no dialog de início (opcional).
  const cameraId = str(formData.get("camera_id"));

  await supabase
    .from("appointment")
    .update({
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      camera_id: cameraId ?? null,
    })
    .eq("id", id);

  // Liga stream + gravação no gateway. Best-effort: gateway offline não pode
  // impedir o atendimento de começar — o tutor apenas fica sem o ao vivo.
  if (cameraId && appt) {
    const result = await openCameraSession(supabase, appt.tenant_id, id, cameraId);
    if (!result.ok)
      console.warn(`[camera] falha ao ligar stream: ${result.error}`);
  }

  revalidatePath(`/atendimentos/${id}`);
  revalidatePath("/atendimentos");
}

/**
 * Troca a sala do atendimento em andamento (banho → tosa) ou desliga a
 * transmissão. Ao contrário do início, aqui o erro do gateway volta para a
 * tela: quem está com o pet na mão precisa saber que o tutor ficou sem imagem.
 */
export type SwitchCameraState = { ok: boolean; error?: string };

export async function switchAppointmentCamera(
  _prev: SwitchCameraState,
  formData: FormData,
): Promise<SwitchCameraState> {
  const id = str(formData.get("appointment_id"));
  if (!id) return { ok: false, error: "Atendimento inválido" };
  const cameraId = str(formData.get("camera_id")) ?? null;

  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointment")
    .select("tenant_id, camera_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!appt) return { ok: false, error: "Atendimento não encontrado" };
  if (appt.status !== "IN_PROGRESS") {
    return { ok: false, error: "O atendimento não está em andamento" };
  }
  if (appt.camera_id === cameraId) return { ok: true };

  const closed = await closeCameraSession(supabase, appt.tenant_id, id, appt.camera_id);

  const { error } = await supabase
    .from("appointment")
    .update({ camera_id: cameraId })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/atendimentos/${id}`);
  revalidatePath("/atendimentos");

  // A troca já está gravada — o tutor migrou de sala pelo Realtime. Se o
  // gateway recusar, o atendimento continua e só a imagem fica pendente.
  if (cameraId) {
    const started = await openCameraSession(supabase, appt.tenant_id, id, cameraId);
    if (!started.ok) {
      console.warn(`[camera] falha ao ligar stream da nova sala: ${started.error}`);
      return { ok: false, error: started.error };
    }
  }
  if (!closed.ok) {
    console.warn(`[camera] falha ao encerrar a sala anterior: ${closed.error}`);
    // Sem sala nova não há o que assistir de qualquer jeito, mas a sala antiga
    // segue gravando — vale avisar em vez de dar a troca por perfeita.
    if (!cameraId) return { ok: false, error: closed.error };
  }
  return { ok: true };
}

/** Marca/desmarca um passo do checklist como concluído. */
export async function toggleStep(formData: FormData) {
  const stepId = str(formData.get("step_id"));
  const appointmentId = str(formData.get("appointment_id"));
  if (!stepId || !appointmentId) return;
  const done = formData.get("done") === "true";

  const supabase = await createClient();
  await supabase
    .from("appointment_step")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", stepId);
  revalidatePath(`/atendimentos/${appointmentId}`);
}

/**
 * Grava o boletim de comportamento do atendimento. Retorna a mensagem de erro,
 * ou undefined em caso de sucesso (inclusive quando não há nada a gravar).
 *
 * Upsert por appointment_id: refinalizar o atendimento atualiza o boletim em vez
 * de duplicá-lo.
 */
async function saveBehaviorReport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: { tenantId: string; petId: string; appointmentId: string; authorId: string },
  formData: FormData,
): Promise<string | undefined> {
  let rawResponses: unknown = [];
  const encoded = str(formData.get("behavior_responses"));
  if (encoded) {
    try {
      rawResponses = JSON.parse(encoded);
    } catch {
      return "Boletim inválido";
    }
  }

  const parsed = behaviorReportInput.safeParse({
    appointment_id: ctx.appointmentId,
    note: str(formData.get("behavior_note")),
    responses: rawResponses,
  });
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Boletim inválido";
  }

  const { note, responses } = parsed.data;
  if (responses.length === 0 && !note) return undefined;

  const { error } = await supabase.from("pet_behavior_report").upsert(
    {
      tenant_id: ctx.tenantId,
      pet_id: ctx.petId,
      appointment_id: ctx.appointmentId,
      overall_score: computeOverallScore(responses),
      responses,
      note: note ?? null,
      author_id: ctx.authorId,
    },
    { onConflict: "appointment_id" },
  );
  return error?.message;
}

/** Finaliza o atendimento: fotos + boletim de comportamento + status COMPLETED. */
export type FinishAppointmentState = { ok: boolean; error?: string };

export async function finishAppointment(
  _prev: FinishAppointmentState,
  formData: FormData,
): Promise<FinishAppointmentState> {
  const id = str(formData.get("appointment_id"));
  if (!id) return { ok: false, error: "Atendimento inválido" };
  const paymentMethod = str(formData.get("payment_method"));
  if (!PAYMENT_METHODS.includes(paymentMethod as PaymentMethod)) {
    return { ok: false, error: "Informe a forma de pagamento" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sessão expirada" };

  const { data: appt, error: appointmentError } = await supabase
    .from("appointment")
    .select("tenant_id, camera_id, pet_id")
    .eq("id", id)
    .single();
  if (appointmentError || !appt) {
    return { ok: false, error: "Atendimento não encontrado" };
  }

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const photos = await uploadPhotos(appt.tenant_id, id, files);

  const { error: finishError } = await supabase
    .from("appointment")
    .update({
      status: "COMPLETED",
      finished_at: new Date().toISOString(),
      payment_method: paymentMethod as PaymentMethod,
      completed_by: user.id,
      ...(photos.length > 0 ? { photos } : {}),
    })
    .eq("id", id);
  if (finishError) return { ok: false, error: finishError.message };

  // Boletim de comportamento (notas por categoria + observação). Ambos são
  // opcionais: sem nota e sem observação, nenhum boletim é gravado.
  const behaviorError = await saveBehaviorReport(
    supabase,
    { tenantId: appt.tenant_id, petId: appt.pet_id, appointmentId: id, authorId: user.id },
    formData,
  );
  if (behaviorError) return { ok: false, error: behaviorError };

  // Fecha a sessão de câmera e encerra stream + gravação no gateway
  // (best-effort; o path também é sobrescrito no próximo atendimento que usar
  // a mesma câmera).
  const closed = await closeCameraSession(supabase, appt.tenant_id, id, appt.camera_id);
  if (!closed.ok) console.warn(`[camera] falha ao encerrar stream: ${closed.error}`);

  revalidatePath(`/atendimentos/${id}`);
  revalidatePath("/atendimentos");
  revalidatePath("/financeiro");
  revalidatePath(`/pets/${appt.pet_id}`);
  return { ok: true };
}
