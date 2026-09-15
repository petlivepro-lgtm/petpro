"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { dispatchNotifications } from "@/lib/notify";
import { hojeKey } from "@/lib/rotas";
import {
  deliveryStopStatusInput,
  routePositionInput,
  type DeliveryStopStatus,
} from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

/**
 * Ações da rota do entregador (0062).
 *
 * Nenhuma delas filtra por colaborador na query: a RLS já recusa parada que
 * não seja dele, e repetir o filtro aqui daria a falsa impressão de que ele é
 * quem protege. O que estas funções fazem é o que a RLS não sabe fazer —
 * carimbar horário, casar status de rota com status de parada, e avisar.
 */

/** Monta (ou recalcula) a rota de hoje e devolve o id. */
export async function buildMyRoute(dia?: string): Promise<FormState> {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { data: me } = await supabase
    .from("collaborator")
    .select("id")
    .maybeSingle();
  if (!me) return { ok: false, error: "Cadastro de entregador não encontrado" };

  const { error } = await supabase.rpc("build_delivery_route", {
    _collaborator: me.id,
    _date: dia ?? hojeKey(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true };
}

/**
 * Começa a rota. É o que liga o rastreamento: fora de IN_PROGRESS o aparelho
 * não manda posição e o tutor não vê ninguém no mapa.
 */
export async function startRoute(routeId: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_route")
    .update({ status: "IN_PROGRESS", started_at: new Date().toISOString() })
    .eq("id", routeId)
    .eq("status", "PLANNED");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true };
}

/**
 * Encerra a rota. O trigger clear_delivery_position (0062) apaga a última
 * posição no mesmo movimento — rota encerrada, rastreamento encerrado.
 */
export async function finishRoute(routeId: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_route")
    .update({ status: "DONE", finished_at: new Date().toISOString() })
    .eq("id", routeId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true };
}

/** Carimbos de horário de cada status, para não espalhar `new Date()` na tela. */
function carimbos(status: DeliveryStopStatus): Record<string, string | null> {
  const agora = new Date().toISOString();
  if (status === "EN_ROUTE") return { arrived_at: null, done_at: null };
  if (status === "DONE") return { arrived_at: agora, done_at: agora };
  if (status === "FAILED") return { done_at: agora };
  return { arrived_at: null, done_at: null };
}

/**
 * Muda o status de uma parada. É esta função que dispara os avisos do tutor:
 * o trigger notify_tutor_delivery (0063) cria a notificação, e o
 * dispatchNotifications empurra o push logo depois — mesmo par usado ao
 * finalizar um atendimento.
 */
export async function setStopStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = deliveryStopStatusInput.safeParse({
    stop_id: formData.get("stop_id"),
    status: formData.get("status"),
    fail_reason: (formData.get("fail_reason") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase
    .from("delivery_stop")
    .update({
      status: parsed.data.status,
      fail_reason: parsed.data.fail_reason ?? null,
      ...carimbos(parsed.data.status),
    })
    .eq("id", parsed.data.stop_id);
  if (error) return { ok: false, error: error.message };

  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true };
}

/** Reordena as paradas na mão — o entregador conhece o trânsito do bairro. */
export async function reorderStops(
  routeId: string,
  ordem: string[],
): Promise<FormState> {
  const supabase = await createClient();

  // Uma chamada por parada porque são poucas (um dia de leva-e-traz tem
  // dezenas, não milhares) e o upsert em lote exigiria reenviar as colunas
  // NOT NULL da linha inteira, com o risco de sobrescrever o que mudou no
  // meio do caminho.
  for (const [i, id] of ordem.entries()) {
    const { error } = await supabase
      .from("delivery_stop")
      .update({ position: i + 1 })
      .eq("id", id)
      .eq("route_id", routeId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/rota");
  return { ok: true };
}

/**
 * Posição do GPS do aparelho. Chamada a cada ~15s enquanto a rota corre, então
 * é de propósito a ação mais barata daqui: um upsert e nenhum revalidatePath —
 * quem redesenha o mapa é o Realtime, não o Next.
 */
export async function pushPosition(
  input: unknown,
): Promise<FormState> {
  const parsed = routePositionInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Posição inválida" };

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { data: me } = await supabase
    .from("collaborator")
    .select("id")
    .maybeSingle();
  if (!me) return { ok: false, error: "Cadastro não encontrado" };

  const { error } = await supabase.from("delivery_position").upsert(
    {
      route_id: parsed.data.route_id,
      tenant_id: tenant.tenantId,
      collaborator_id: me.id,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      accuracy_m: parsed.data.accuracy_m ?? null,
      heading: parsed.data.heading ?? null,
      speed_ms: parsed.data.speed_ms ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "route_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
