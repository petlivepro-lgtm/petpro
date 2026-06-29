"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appointmentStatusUpdate, reservationCancel } from "@mylivepet/types";

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

/** Staff confirma uma reserva de produtos: marca como separada (PICKED). */
export async function confirmReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({ reservation_id: formData.get("reservation_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("product_reservation")
    .update({ status: "PICKED" })
    .eq("id", parsed.data.reservation_id);

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
}

/** Staff recusa uma reserva: cancela e devolve o estoque (RPC com privilégio). */
export async function rejectReservation(formData: FormData) {
  const parsed = reservationCancel.safeParse({ reservation_id: formData.get("reservation_id") });
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase.rpc("staff_cancel_reservation", { p_reservation_id: parsed.data.reservation_id });

  revalidatePath("/solicitacoes");
  revalidatePath("/produtos");
}
