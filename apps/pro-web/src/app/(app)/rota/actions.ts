"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { dispatchNotifications } from "@/lib/notify";
import { hojeKey } from "@/lib/rotas";
import {
  deliveryStopStatusInput,
  routePositionInput,
  type DeliveryStopKind,
  type DeliveryStopStatus,
} from "@mylivepet/types";

export type FormState = {
  ok: boolean;
  error?: string;
  /** A ação colocou a rota em andamento — a tela liga o GPS. */
  rotaEmAndamento?: boolean;
};

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
 * Começa a rota — ou retoma uma encerrada que ainda tinha parada por fazer.
 * É o que liga o rastreamento: fora de IN_PROGRESS o aparelho não manda
 * posição e o tutor não vê ninguém no mapa.
 */
export async function startRoute(routeId: string): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_route")
    .update({
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      finished_at: null,
    })
    .eq("id", routeId)
    .in("status", ["PLANNED", "DONE"]);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true, rotaEmAndamento: true };
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

/**
 * Para onde cada parada pode ir a partir de onde está. A tela só mostra os
 * botões válidos, mas a ação confere de novo: dois aparelhos abertos, ou um
 * clique duplo, não podem pular etapa.
 *
 * Voltar de EN_ROUTE para PENDING existe para o "saí para a parada errada".
 */
const TRANSICOES: Record<DeliveryStopKind, Partial<Record<DeliveryStopStatus, DeliveryStopStatus[]>>> = {
  PICKUP: {
    PENDING: ["EN_ROUTE"],
    EN_ROUTE: ["PICKED_UP", "FAILED", "PENDING"],
    PICKED_UP: ["DONE"],
  },
  DROPOFF: {
    PENDING: ["EN_ROUTE"],
    EN_ROUTE: ["DONE", "FAILED", "PENDING"],
  },
};

/** Carimbos de horário de cada etapa, para não espalhar `new Date()` na tela. */
function carimbos(
  kind: DeliveryStopKind,
  status: DeliveryStopStatus,
): Record<string, string | null> {
  const agora = new Date().toISOString();
  switch (status) {
    case "PENDING":
    case "EN_ROUTE":
      return { arrived_at: null, done_at: null };
    // Chegou na casa e pegou o pet.
    case "PICKED_UP":
      return { arrived_at: agora };
    // Na busca, arrived_at já é da casa do tutor; o DONE é o petshop.
    case "DONE":
      return kind === "PICKUP" ? { done_at: agora } : { arrived_at: agora, done_at: agora };
    case "FAILED":
      return { done_at: agora };
  }
}

/**
 * Sair para uma parada põe a rota em andamento sozinho: o entregador não
 * precisa lembrar de "iniciar" antes, e é isso que liga o GPS e o mapa ao
 * vivo do tutor. Vale também para rota encerrada por engano.
 */
async function garantirRotaEmAndamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  routeId: string,
) {
  await supabase
    .from("delivery_route")
    .update({
      status: "IN_PROGRESS",
      started_at: new Date().toISOString(),
      finished_at: null,
    })
    .eq("id", routeId)
    .in("status", ["PLANNED", "DONE"]);
}

/**
 * Muda o status de uma parada. É esta função que dispara os avisos do tutor:
 * o trigger notify_tutor_delivery (0067) cria a notificação, e o
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

  const { data: parada } = await supabase
    .from("delivery_stop_card")
    .select("id, route_id, kind, status, appointment_status")
    .eq("id", parsed.data.stop_id)
    .maybeSingle();
  if (!parada?.kind || !parada.status || !parada.route_id) {
    return { ok: false, error: "Parada não encontrada" };
  }

  const destino = parsed.data.status;
  if (!TRANSICOES[parada.kind][parada.status]?.includes(destino)) {
    return { ok: false, error: "Esta parada já mudou — atualize a tela" };
  }
  if (
    parada.kind === "DROPOFF" &&
    destino === "EN_ROUTE" &&
    parada.appointment_status !== "COMPLETED"
  ) {
    return { ok: false, error: "O atendimento deste pet ainda não terminou" };
  }

  const { error } = await supabase
    .from("delivery_stop")
    .update({
      status: destino,
      fail_reason: parsed.data.fail_reason ?? null,
      ...carimbos(parada.kind, destino),
    })
    .eq("id", parada.id!)
    // Trava otimista: se outro aparelho mexeu no meio, não sobrescreve.
    .eq("status", parada.status);
  if (error) return { ok: false, error: error.message };

  const saiu = destino === "EN_ROUTE";
  if (saiu) await garantirRotaEmAndamento(supabase, parada.route_id);

  await dispatchNotifications(tenant.tenantId);

  revalidatePath("/");
  revalidatePath("/rota");
  return { ok: true, rotaEmAndamento: saiu };
}

/**
 * "Cheguei no petshop": todos os pets que estão com ele descem de uma vez.
 * O trigger da 0067 faz o check-in de cada atendimento, e o tutor recebe o
 * aviso de que o pet chegou.
 */
export async function arriveAtShop(routeId: string): Promise<FormState> {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { error } = await supabase
    .from("delivery_stop")
    .update({ status: "DONE", done_at: new Date().toISOString() })
    .eq("route_id", routeId)
    .eq("kind", "PICKUP")
    .eq("status", "PICKED_UP");
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
    .select("id, vehicle")
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
      vehicle: me.vehicle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "route_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
