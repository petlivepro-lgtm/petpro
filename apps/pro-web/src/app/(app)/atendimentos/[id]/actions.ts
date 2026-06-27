"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appointmentStepInput, behaviorFeedbackInput } from "@mylivepet/types";

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
    if (!error) urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
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
      .select("default_steps")
      .eq("id", appt.service_type_id)
      .single();
    const defaultSteps = service?.default_steps ?? [];
    if (defaultSteps.length > 0) {
      const { count } = await supabase
        .from("appointment_step")
        .select("id", { count: "exact", head: true })
        .eq("appointment_id", id);
      if ((count ?? 0) === 0) {
        await supabase.from("appointment_step").insert(
          defaultSteps.map((label, position) => ({
            tenant_id: appt.tenant_id,
            appointment_id: id,
            label,
            position,
            done: false,
            done_at: null,
          })),
        );
      }
    }
  }

  await supabase
    .from("appointment")
    .update({ status: "IN_PROGRESS", started_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath(`/atendimentos/${id}`);
}

/** Registra um passo/observação no atendimento em andamento. */
export async function addStep(formData: FormData) {
  const parsed = appointmentStepInput.safeParse({
    appointment_id: str(formData.get("appointment_id")),
    label: str(formData.get("label")),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointment")
    .select("tenant_id")
    .eq("id", parsed.data.appointment_id)
    .single();
  if (!appt) return;

  const { count } = await supabase
    .from("appointment_step")
    .select("id", { count: "exact", head: true })
    .eq("appointment_id", parsed.data.appointment_id);

  await supabase.from("appointment_step").insert({
    tenant_id: appt.tenant_id,
    appointment_id: parsed.data.appointment_id,
    label: parsed.data.label,
    position: count ?? 0,
    done: false,
    done_at: null,
  });
  revalidatePath(`/atendimentos/${parsed.data.appointment_id}`);
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

/** Finaliza o atendimento: fotos + comportamento + status COMPLETED. */
export async function finishAppointment(formData: FormData) {
  const id = str(formData.get("appointment_id"));
  if (!id) return;

  const supabase = await createClient();
  const { data: appt } = await supabase
    .from("appointment")
    .select("tenant_id")
    .eq("id", id)
    .single();
  if (!appt) return;

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const photos = await uploadPhotos(appt.tenant_id, id, files);

  await supabase
    .from("appointment")
    .update({
      status: "COMPLETED",
      finished_at: new Date().toISOString(),
      ...(photos.length > 0 ? { photos } : {}),
    })
    .eq("id", id);

  // Relato de comportamento (opcional) → feedback STAFF_TO_TUTOR.
  const behavior = behaviorFeedbackInput.safeParse({
    appointment_id: id,
    comment: str(formData.get("behavior")),
  });
  if (behavior.success) {
    await supabase.from("feedback").insert({
      tenant_id: appt.tenant_id,
      appointment_id: id,
      direction: "STAFF_TO_TUTOR",
      comment: behavior.data.comment,
    });
  }

  revalidatePath(`/atendimentos/${id}`);
  revalidatePath("/atendimentos");
}
