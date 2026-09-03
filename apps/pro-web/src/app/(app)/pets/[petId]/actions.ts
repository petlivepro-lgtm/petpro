"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { uploadPetPhoto } from "@/lib/pet-photo";
import {
  canMutateAsRole,
  petInput,
  PET_SIZES,
  type PetSize,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

function size(v: FormDataEntryValue | null): PetSize | undefined {
  const s = typeof v === "string" ? v : "";
  return (PET_SIZES as readonly string[]).includes(s)
    ? (s as PetSize)
    : undefined;
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

/**
 * Atualiza o cadastro do pet (a foto tem a action própria acima).
 * O tutor não muda por aqui: o pet continua no mesmo cliente.
 */
export async function updatePet(_prev: FormState, formData: FormData): Promise<FormState> {
  const petId = str(formData.get("pet_id"));
  if (!petId) return { ok: false, error: "Pet inválido" };

  const parsed = petInput.safeParse({
    tutor_id: formData.get("tutor_id"),
    name: formData.get("name"),
    species: str(formData.get("species")),
    breed: str(formData.get("breed")),
    size: size(formData.get("size")),
    birth_date: str(formData.get("birth_date")),
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };
  if (!canMutateAsRole(tenant.role)) return { ok: false, error: "Seu acesso é somente leitura" };

  const { error } = await supabase
    .from("pet")
    .update({
      name: parsed.data.name,
      species: parsed.data.species ?? null,
      breed: parsed.data.breed ?? null,
      size: parsed.data.size ?? null,
      // `||` e não `??`: limpar o campo precisa gravar null, não "".
      birth_date: parsed.data.birth_date || null,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", petId)
    .eq("tenant_id", tenant.tenantId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/pets/${petId}`);
  revalidatePath("/tutores"); // nome e raça também aparecem no card do tutor
  return { ok: true };
}
