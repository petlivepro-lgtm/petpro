"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { uploadPetPhoto } from "@/lib/pet-photo";
import { petInput } from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function size(v: FormDataEntryValue | null): "pequeno" | "medio" | "grande" | undefined {
  const s = typeof v === "string" ? v : "";
  return s === "pequeno" || s === "medio" || s === "grande" ? s : undefined;
}

/** RLS (pet_tutor_write) garante que o tutor só cria/edita os próprios pets. */
export async function createPet(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { ok: false, error: "Sessão inválida" };

  const parsed = petInput.safeParse({
    tutor_id: ctx.tutorId,
    name: str(formData.get("name")),
    species: str(formData.get("species")),
    breed: str(formData.get("breed")),
    size: size(formData.get("size")),
    birth_date: str(formData.get("birth_date")),
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    photoPath = await uploadPetPhoto(ctx.tenantId, photo);
    if (!photoPath) return { ok: false, error: "Falha ao enviar a foto" };
  }

  const { error } = await supabase.from("pet").insert({
    tenant_id: ctx.tenantId,
    tutor_id: ctx.tutorId,
    name: parsed.data.name,
    species: parsed.data.species ?? null,
    breed: parsed.data.breed ?? null,
    size: parsed.data.size ?? null,
    birth_date: parsed.data.birth_date ?? null,
    notes: parsed.data.notes ?? null,
    photo_path: photoPath,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/meus-pets");
  revalidatePath("/");
  return { ok: true };
}

export async function updatePet(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Pet inválido" };

  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return { ok: false, error: "Sessão inválida" };

  const parsed = petInput.safeParse({
    tutor_id: ctx.tutorId,
    name: str(formData.get("name")),
    species: str(formData.get("species")),
    breed: str(formData.get("breed")),
    size: size(formData.get("size")),
    birth_date: str(formData.get("birth_date")),
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  // Mantém a foto atual a menos que um novo arquivo seja enviado.
  let photoUpdate: { photo_path: string } | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const url = await uploadPetPhoto(ctx.tenantId, photo);
    if (!url) return { ok: false, error: "Falha ao enviar a foto" };
    photoUpdate = { photo_path: url };
  }

  const { error } = await supabase
    .from("pet")
    .update({
      name: parsed.data.name,
      species: parsed.data.species ?? null,
      breed: parsed.data.breed ?? null,
      size: parsed.data.size ?? null,
      birth_date: parsed.data.birth_date ?? null,
      notes: parsed.data.notes ?? null,
      ...photoUpdate,
    })
    .eq("id", id)
    .eq("tutor_id", ctx.tutorId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/meus-pets");
  revalidatePath("/configuracoes");
  revalidatePath("/");
  return { ok: true };
}
