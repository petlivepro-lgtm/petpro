"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import {
  canMutateAsRole,
  clubinhoPlanInput,
  type Json,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

async function clubinhoContext() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { error: "Sem petshop vinculado" as const };
  if (!canMutateAsRole(tenant.role))
    return { error: "Seu acesso é somente leitura" as const };
  return { supabase, tenant };
}

/** Revalida tudo que exibe plano ou saldo. */
function revalidateClubinho() {
  revalidatePath("/configuracoes/clubinho");
  revalidatePath("/clubinho");
  revalidatePath("/tutores");
}

/**
 * Cria ou atualiza um plano com a grade de serviços numa transação só
 * (save_clubinho_plan, 0048). O zod repete as checagens da RPC para o erro
 * sair legível antes da ida ao banco.
 *
 * Mudar o plano não mexe nos ciclos já abertos: quem pagou 4 banhos continua
 * com 4 até a renovação. A tela avisa isso na hora de salvar.
 */
export async function saveClubinhoPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  let items: unknown = [];
  const encoded = str(formData.get("items"));
  if (encoded) {
    try {
      items = JSON.parse(encoded);
    } catch {
      return { ok: false, error: "Serviços do plano inválidos" };
    }
  }

  const cycle = str(formData.get("cycle"));
  const parsed = clubinhoPlanInput.safeParse({
    id: str(formData.get("id")),
    name: str(formData.get("name")) ?? "",
    description: str(formData.get("description")),
    price_cents: str(formData.get("price")) ?? 0,
    cycle,
    // Só o ciclo personalizado usa o campo; nos demais o intervalo é fixo no
    // banco e mandar um número aqui só criaria uma expectativa falsa.
    cycle_days:
      cycle === "CUSTOM" ? (str(formData.get("cycle_days")) ?? undefined) : undefined,
    rollover: formData.get("rollover") === "on",
    active: formData.get("active") === "on",
    items,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }

  const context = await clubinhoContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase.rpc("save_clubinho_plan", {
    p_tenant: context.tenant.tenantId,
    p_plan: parsed.data as unknown as Json,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe um plano com esse nome"
          : error.message,
    };
  }

  revalidateClubinho();
  return { ok: true };
}

/**
 * Exclui o plano. O banco recusa (FK restrict) enquanto houver assinatura
 * apontando para ele — inclusive cancelada, porque o histórico da assinatura
 * precisa do plano para continuar legível. Nesse caso, desativar é o caminho:
 * some da lista de adesão sem apagar nada.
 */
export async function deleteClubinhoPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Plano inválido" };

  const context = await clubinhoContext();
  if ("error" in context) return { ok: false, error: context.error };

  const { error } = await context.supabase
    .from("clubinho_plan")
    .delete()
    .eq("id", id)
    .eq("tenant_id", context.tenant.tenantId);
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23503"
          ? "Este plano já foi assinado por algum pet — desative em vez de excluir."
          : error.message,
    };
  }

  revalidateClubinho();
  return { ok: true };
}
