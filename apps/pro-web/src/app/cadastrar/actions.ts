"use server";

import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { petshopSignup } from "@mylivepet/types";

export type SignupResult = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Gera um slug a partir do nome do petshop. */
function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "petshop"
  );
}

/** Cria petshop (tenant) + dono (profile + membership OWNER) e o usuário de auth. */
export async function registerPetshop(formData: FormData): Promise<SignupResult> {
  const parsed = petshopSignup.safeParse({
    petshop_name: str(formData.get("petshop_name")),
    full_name: str(formData.get("full_name")),
    email: str(formData.get("email")),
    password: str(formData.get("password")),
    phone: str(formData.get("phone")),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const { petshop_name, full_name, email, password, phone } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });
  if (authError || !created?.user) {
    const dup = authError?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      error: dup ? "Já existe uma conta com este e-mail." : authError?.message ?? "Falha ao criar conta.",
    };
  }
  const userId = created.user.id;

  const { error: profileError } = await admin.from("profile").insert({
    id: userId,
    full_name,
    phone: phone ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profileError.message };
  }

  // Cria o tenant com slug único (refaz com sufixo em caso de colisão).
  const base = slugify(petshop_name);
  let tenantId: string | null = null;
  for (let attempt = 0; attempt < 5 && !tenantId; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomBytes(2).toString("hex")}`;
    const { data: tenant, error: tenantError } = await admin
      .from("tenant")
      .insert({ name: petshop_name, slug })
      .select("id")
      .single();
    if (tenant) {
      tenantId = tenant.id;
    } else if (tenantError?.code !== "23505") {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: tenantError?.message ?? "Falha ao criar o petshop." };
    }
  }
  if (!tenantId) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "Não foi possível gerar um identificador para o petshop." };
  }

  const { error: membershipError } = await admin.from("membership").insert({
    tenant_id: tenantId,
    profile_id: userId,
    role: "OWNER",
  });
  if (membershipError) {
    await admin.from("tenant").delete().eq("id", tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: membershipError.message };
  }

  return { ok: true };
}
