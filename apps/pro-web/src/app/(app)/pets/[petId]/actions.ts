"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
