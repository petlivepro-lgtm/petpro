import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types";
import type { DeliveryStopKind, DeliveryStopStatus, DeliveryVehicle } from "@mylivepet/types";

/**
 * "Alguém está a caminho da minha casa?" — o lado do tutor do leva-e-traz
 * (0062).
 *
 * Aqui não existe a view delivery_stop_card: ela é do entregador e traz o
 * telefone do tutor, que para o próprio tutor não faz sentido nenhum. O que o
 * tutor lê é a tabela, pela policy delivery_stop_tutor, e a RLS já garante
 * que só voltem as paradas dos atendimentos dele.
 *
 * String literal única em módulo neutro, como o supabase-js exige.
 */
export const CHEGADA_SELECT =
  "id, route_id, kind, status, eta_at, lat, lng, appointment:appointment_id!inner(id, scheduled_at, pet:pet_id(id, name, photo_path))";

type RawChegada = {
  id: string;
  route_id: string;
  kind: DeliveryStopKind;
  status: DeliveryStopStatus;
  eta_at: string | null;
  lat: number | null;
  lng: number | null;
  appointment: {
    id: string;
    scheduled_at: string | null;
    pet: { id: string; name: string; photo_path: string | null } | null;
  } | null;
};

export type Chegada = {
  id: string;
  routeId: string;
  kind: DeliveryStopKind;
  status: DeliveryStopStatus;
  petName: string;
  petPhoto: string | null;
  scheduledAt: string | null;
  /** Destino — a casa do tutor. Null quando o endereço não virou coordenada. */
  destino: { lat: number; lng: number } | null;
};

export type PosicaoEntregador = {
  lat: number;
  lng: number;
  atualizadoEm: string;
  heading: number | null;
  /** Moto, bicicleta ou carro — o mesmo ícone que o entregador vê no mapa dele. */
  veiculo: DeliveryVehicle | null;
};

export function mapChegadas(rows: RawChegada[]): Chegada[] {
  return rows.map((s) => ({
    id: s.id,
    routeId: s.route_id,
    kind: s.kind,
    status: s.status,
    petName: s.appointment?.pet?.name ?? "seu pet",
    petPhoto: s.appointment?.pet?.photo_path ?? null,
    scheduledAt: s.appointment?.scheduled_at ?? null,
    destino:
      s.lat !== null && s.lng !== null
        ? { lat: Number(s.lat), lng: Number(s.lng) }
        : null,
  }));
}

/**
 * As paradas de hoje do tutor.
 *
 * O `!inner` no embed não é enfeite: o filtro por `appointment.scheduled_at`
 * abaixo é sobre coluna da tabela relacionada, e sem o inner join o PostgREST
 * devolve a parada assim mesmo, só que com o atendimento nulo — a tela ficaria
 * dizendo "seu pet" no lugar do nome. Traz também as já concluídas do dia para a tela
 * poder dizer "seu pet chegou em casa" em vez de simplesmente esvaziar assim
 * que o entregador vai embora.
 */
export async function fetchChegadas(
  supabase: SupabaseClient<Database>,
): Promise<Chegada[]> {
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("delivery_stop")
    .select(CHEGADA_SELECT)
    .gte("appointment.scheduled_at", inicioDoDia.toISOString())
    .order("position");

  return mapChegadas((data ?? []) as unknown as RawChegada[]);
}

/**
 * Onde o entregador está.
 *
 * Vem vazio quase sempre, e isso é o desenho, não uma falha: a policy
 * delivery_position_tutor só abre a linha enquanto existe uma parada EN_ROUTE
 * do tutor. Terminada a entrega, o tutor deixa de enxergar o entregador —
 * ninguém acompanha o motorista na casa do vizinho.
 */
export async function fetchPosicao(
  supabase: SupabaseClient<Database>,
  routeId: string,
): Promise<PosicaoEntregador | null> {
  const { data } = await supabase
    .from("delivery_position")
    .select("lat, lng, updated_at, heading, vehicle")
    .eq("route_id", routeId)
    .maybeSingle();

  if (!data) return null;
  return {
    lat: Number(data.lat),
    lng: Number(data.lng),
    atualizadoEm: data.updated_at,
    heading: data.heading === null ? null : Number(data.heading),
    veiculo: data.vehicle,
  };
}

/** A parada que está acontecendo agora, se houver. */
export function chegadaAtiva(chegadas: Chegada[]): Chegada | null {
  return chegadas.find((c) => c.status === "EN_ROUTE") ?? null;
}

/**
 * Distância em linha reta, em metros (Haversine).
 *
 * Linha reta e não distância de rua: calcular a rota de verdade exigiria uma
 * chamada externa a cada atualização do GPS, para responder a uma pergunta que
 * o tutor faz por ansiedade, não por logística. A tela diz "em linha reta"
 * justamente para não prometer precisão que este número não tem.
 */
export function distanciaEmMetros(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
