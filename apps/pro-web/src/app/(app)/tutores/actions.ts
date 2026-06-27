"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { tutorInput, petInput } from "@mylivepet/types";

export type FormState = {
  ok: boolean;
  error?: string;
  access?: { email: string; password: string };
};

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Gera uma senha temporária legível, ex.: "Pet-7k29xQ4m". */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `Pet-${out}`;
}

/** Cria um tutor e, opcionalmente, o primeiro pet (na mesma submissão). */
export async function createTutor(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = tutorInput.safeParse({
    full_name: formData.get("full_name"),
    email: str(formData.get("email")) ?? "",
    phone: str(formData.get("phone")),
    notes: str(formData.get("notes")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const createAccess = formData.get("create_access") === "on";
  if (createAccess && !parsed.data.email) {
    return { ok: false, error: "Informe um e-mail para criar o acesso ao app." };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { data: tutor, error } = await supabase
    .from("tutor")
    .insert({
      tenant_id: tenant.tenantId,
      full_name: parsed.data.full_name,
      email: parsed.data.email || null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !tutor) return { ok: false, error: error?.message ?? "Falha ao salvar" };

  // Primeiro pet (opcional)
  const petName = str(formData.get("pet_name"));
  if (petName) {
    const petParsed = petInput.safeParse({
      tutor_id: tutor.id,
      name: petName,
      species: str(formData.get("pet_species")),
      breed: str(formData.get("pet_breed")),
      size: str(formData.get("pet_size")) as "pequeno" | "medio" | "grande" | undefined,
      birth_date: str(formData.get("pet_birth_date")),
    });
    if (petParsed.success) {
      await supabase.from("pet").insert({
        tenant_id: tenant.tenantId,
        tutor_id: tutor.id,
        name: petParsed.data.name,
        species: petParsed.data.species ?? null,
        breed: petParsed.data.breed ?? null,
        size: petParsed.data.size ?? null,
        birth_date: petParsed.data.birth_date || null,
      });
    }
  }

  // Acesso ao app MyLivePet (opcional): cria usuário de auth com senha temporária
  // e vincula tutor.profile_id. Exige service role (cria auth user + profile).
  let access: FormState["access"];
  if (createAccess && parsed.data.email) {
    try {
      const admin = createAdminClient();
      const tempPassword = generateTempPassword();

      const { data: created, error: authError } = await admin.auth.admin.createUser({
        email: parsed.data.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.full_name, must_reset_password: true },
      });
      if (authError || !created?.user) {
        const dup = authError?.message?.toLowerCase().includes("already");
        return {
          ok: false,
          error: dup
            ? "Já existe acesso para este e-mail."
            : authError?.message ?? "Falha ao criar acesso ao app.",
        };
      }

      const userId = created.user.id;
      const { error: profileError } = await admin.from("profile").insert({
        id: userId,
        full_name: parsed.data.full_name,
        phone: parsed.data.phone ?? null,
      });
      if (profileError) {
        await admin.auth.admin.deleteUser(userId); // evita usuário órfão
        return { ok: false, error: profileError.message };
      }

      await admin.from("tutor").update({ profile_id: userId }).eq("id", tutor.id);
      access = { email: parsed.data.email, password: tempPassword };
    } catch (e) {
      // Tutor já foi criado; só o acesso falhou — mostra o motivo em vez de quebrar.
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      return { ok: false, error: "Tutor salvo, mas falha ao criar o acesso: " + msg };
    }
  }

  revalidatePath("/tutores");
  return { ok: true, access };
}

/** Adiciona um pet a um tutor existente. */
export async function createPet(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = petInput.safeParse({
    tutor_id: formData.get("tutor_id"),
    name: formData.get("name"),
    species: str(formData.get("species")),
    breed: str(formData.get("breed")),
    size: str(formData.get("size")) as "pequeno" | "medio" | "grande" | undefined,
    birth_date: str(formData.get("birth_date")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase.from("pet").insert({
    tenant_id: tenant.tenantId,
    tutor_id: parsed.data.tutor_id,
    name: parsed.data.name,
    species: parsed.data.species ?? null,
    breed: parsed.data.breed ?? null,
    size: parsed.data.size ?? null,
    birth_date: parsed.data.birth_date || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/tutores");
  return { ok: true };
}

/**
 * Exclui um tutor (e, em cascata, seus pets/atendimentos/reservas/etc.).
 * Se o tutor tinha login no app e nenhum outro tutor usa esse profile,
 * remove também o usuário de auth (cascateia a linha profile).
 */
export async function deleteTutor(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("tutor_id"));
  if (!id) return { ok: false, error: "Tutor inválido" };

  const supabase = await createClient();

  // RLS (tutor_staff) garante que o staff só lê/apaga tutores do próprio tenant.
  const { data: tutor, error: findError } = await supabase
    .from("tutor")
    .select("id, profile_id")
    .eq("id", id)
    .single();
  if (findError || !tutor) return { ok: false, error: "Tutor não encontrado" };

  // Remove o login do app ANTES de apagar o tutor — se falhar, nada fica meio-apagado.
  // Só exclui o auth se nenhum OUTRO tutor ainda referencia esse profile.
  if (tutor.profile_id) {
    const { data: others } = await supabase
      .from("tutor")
      .select("id")
      .eq("profile_id", tutor.profile_id)
      .neq("id", id)
      .limit(1);
    if (!others || others.length === 0) {
      const { error: authErr } = await createAdminClient().auth.admin.deleteUser(
        tutor.profile_id,
      );
      if (authErr) {
        return { ok: false, error: "Não foi possível excluir o login do tutor: " + authErr.message };
      }
    }
  }

  const { error: delError } = await supabase.from("tutor").delete().eq("id", id);
  if (delError) return { ok: false, error: delError.message };

  revalidatePath("/tutores");
  return { ok: true };
}
