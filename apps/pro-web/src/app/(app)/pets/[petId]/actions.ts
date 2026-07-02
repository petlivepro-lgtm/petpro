"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uploadPetPhoto } from "@/lib/pet-photo";

export type FormState = { ok: boolean; error?: string };

/** Cria um atendimento (origin STAFF, já confirmado) para o pet a partir da ficha. */
export async function createStaffAppointment(formData: FormData) {
  const petId = String(formData.get("pet_id") ?? "");
  if (!petId) return;

  const supabase = await createClient();
  const { data: pet } = await supabase
    .from("pet")
    .select("id, tenant_id, tutor_id")
    .eq("id", petId)
    .single();
  if (!pet) return;

  await supabase.from("appointment").insert({
    tenant_id: pet.tenant_id,
    pet_id: pet.id,
    tutor_id: pet.tutor_id,
    origin: "STAFF",
    status: "CONFIRMED",
    scheduled_at: new Date().toISOString(),
  });

  revalidatePath(`/pets/${petId}`);
}

/** Troca a foto do pet. RLS (pet_staff) garante acesso apenas a pets do tenant. */
export async function updatePetPhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const petId = String(formData.get("pet_id") ?? "");
  if (!petId) return { ok: false, error: "Pet inválido" };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, error: "Escolha uma imagem" };
  }

  const supabase = await createClient();
  const { data: pet } = await supabase
    .from("pet")
    .select("id, tenant_id")
    .eq("id", petId)
    .maybeSingle();
  if (!pet) return { ok: false, error: "Pet não encontrado" };

  const url = await uploadPetPhoto(pet.tenant_id, photo);
  if (!url) return { ok: false, error: "Falha ao enviar a foto" };

  const { error } = await supabase.from("pet").update({ photo_path: url }).eq("id", petId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pets/${petId}`);
  return { ok: true };
}
