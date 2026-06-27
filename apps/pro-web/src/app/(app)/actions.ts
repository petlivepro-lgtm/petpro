"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appointmentStatusUpdate } from "@mylivepet/types";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Staff confirma/recusa/avança o status de um atendimento (RLS garante o tenant). */
export async function updateAppointmentStatus(formData: FormData) {
  const parsed = appointmentStatusUpdate.safeParse({
    appointment_id: formData.get("appointment_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("appointment")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.appointment_id);

  revalidatePath("/solicitacoes");
  revalidatePath("/atendimentos");
}
