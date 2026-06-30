"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { tutorInput } from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** RLS (tutor_self_update) garante que o tutor só edita a própria ficha. */
export async function updateTutorProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { ok: false, error: "Sessão inválida" };

  const parsed = tutorInput.safeParse({
    full_name: str(formData.get("full_name")),
    email: str(formData.get("email")) ?? "",
    phone: str(formData.get("phone")),
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { error } = await supabase
    .from("tutor")
    .update({
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", ctx.tutorId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/configuracoes");
  revalidatePath("/", "layout");
  return { ok: true };
}
