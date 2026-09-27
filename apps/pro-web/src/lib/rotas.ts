import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import {
  formatAddressLine,
  type AppointmentStatus,
  type DeliveryRouteStatus,
  type DeliveryStopKind,
  type DeliveryStopStatus,
} from "@mylivepet/types";

/**
 * A rota do dia do entregador (0062).
 *
 * As paradas vêm da VIEW delivery_stop_card, e não da tabela: é ela que junta
 * o telefone do tutor ao endereço sem abrir a tabela `tutor` inteira para o
 * entregador (RLS é por linha, não por coluna — ver o comentário da view).
 *
 * String literal única e em módulo neutro, como manda o supabase-js: montar
 * este select com concatenação, ou exportá-lo de um "use client", quebra a
 * inferência de tipos do PostgREST.
 */
export const PARADA_SELECT =
  "id, route_id, appointment_id, kind, position, status, eta_at, arrived_at, done_at, fail_reason, cep, street, street_number, complement, district, city, state, lat, lng, scheduled_at, appointment_status, pet_id, pet_name, species, size, photo_path, tutor_id, tutor_name, tutor_phone, service_name";

type RawParada = {
  id: string;
  route_id: string;
  appointment_id: string;
  kind: DeliveryStopKind;
  position: number;
  status: DeliveryStopStatus;
  eta_at: string | null;
  arrived_at: string | null;
  done_at: string | null;
  fail_reason: string | null;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  scheduled_at: string | null;
  appointment_status: AppointmentStatus | null;
  pet_id: string | null;
  pet_name: string | null;
  photo_path: string | null;
  tutor_id: string | null;
  tutor_name: string | null;
  tutor_phone: string | null;
  service_name: string | null;
};

export type ParadaRow = {
  id: string;
  routeId: string;
  appointmentId: string;
  kind: DeliveryStopKind;
  position: number;
  status: DeliveryStopStatus;
  etaAt: string | null;
  doneAt: string | null;
  failReason: string | null;
  petId: string | null;
  petName: string;
  petPhoto: string | null;
  tutorName: string | null;
  tutorPhone: string | null;
  serviceName: string | null;
  scheduledAt: string | null;
  appointmentStatus: AppointmentStatus | null;
  /** Endereço em uma linha, ou null quando não há nada preenchido. */
  endereco: string | null;
  /** Bairro sozinho, para as listas compactas onde o endereço inteiro não cabe. */
  bairro: string | null;
  lat: number | null;
  lng: number | null;
  /**
   * Dá para pôr no mapa? Sem coordenada a parada ainda aparece na lista, com
   * o endereço escrito — sumir dela seria esconder trabalho a fazer.
   */
  temPonto: boolean;
};

export type RotaDoDia = {
  id: string;
  status: DeliveryRouteStatus;
  routeDate: string;
  startedAt: string | null;
  paradas: ParadaRow[];
} | null;

export function mapParadas(rows: RawParada[]): ParadaRow[] {
  return rows
    .map((s) => ({
      id: s.id,
      routeId: s.route_id,
      appointmentId: s.appointment_id,
      kind: s.kind,
      position: s.position,
      status: s.status,
      etaAt: s.eta_at,
      doneAt: s.done_at,
      failReason: s.fail_reason,
      petId: s.pet_id,
      petName: s.pet_name ?? "Pet",
      petPhoto: s.photo_path,
      tutorName: s.tutor_name,
      tutorPhone: s.tutor_phone,
      serviceName: s.service_name,
      scheduledAt: s.scheduled_at,
      appointmentStatus: s.appointment_status,
      endereco: formatAddressLine(s),
      bairro: s.district,
      lat: s.lat === null ? null : Number(s.lat),
      lng: s.lng === null ? null : Number(s.lng),
      temPonto: s.lat !== null && s.lng !== null,
    }))
    .sort((a, b) => a.position - b.position);
}

/**
 * Que dia é hoje para a rota — sempre no fuso do petshop, nunca no de quem
 * está olhando.
 *
 * Não é preciosismo: `build_delivery_route` decide o dia de cada atendimento
 * com `at time zone 'America/Sao_Paulo'` (0062), e o servidor da Vercel roda
 * em UTC. Calcular "hoje" com o relógio do servidor faria a rota virar às 21h,
 * e o entregador abriria o painel do dia seguinte no meio do expediente.
 */
export function hojeKey(d = new Date()): string {
  // en-CA formata como YYYY-MM-DD, que é exatamente o formato de `date`.
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * A rota de um dia com as paradas. Não filtra por colaborador: a RLS de 0062
 * já entrega só a rota de quem está pedindo — mesmo arranjo de
 * fetchAtendimentos.
 */
export async function fetchRota(
  supabase: SupabaseClient<Database>,
  dia: string,
): Promise<RotaDoDia> {
  const { data: rota } = await supabase
    .from("delivery_route")
    .select("id, status, route_date, started_at")
    .eq("route_date", dia)
    .maybeSingle();

  if (!rota) return null;

  const { data: paradas } = await supabase
    .from("delivery_stop_card")
    .select(PARADA_SELECT)
    .eq("route_id", rota.id)
    .order("position");

  return {
    id: rota.id,
    status: rota.status,
    routeDate: rota.route_date,
    startedAt: rota.started_at,
    paradas: mapParadas((paradas ?? []) as unknown as RawParada[]),
  };
}

/**
 * "14:30" de um timestamp, no fuso do petshop — mesmo motivo de `hojeKey`: o
 * servidor roda em UTC e mostraria o horário três horas adiantado.
 */
export function horaSP(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * O horário que importa para cada parada, com uma legenda curta.
 *
 * Nada é estimado (0069): a busca é no horário agendado do atendimento, e a
 * devolução só tem horário quando o petshop finaliza o serviço — antes disso
 * ela está só aguardando.
 */
export function horarioDaParada(p: ParadaRow): { hora: string | null; legenda: string | null } {
  if (p.kind === "PICKUP") return { hora: horaSP(p.scheduledAt), legenda: null };
  if (p.appointmentStatus === "COMPLETED") return { hora: horaSP(p.etaAt), legenda: "pronto" };
  return { hora: null, legenda: "aguardando" };
}

/** Parada que já saiu da fila, bem ou mal. */
export function paradaEncerrada(p: ParadaRow): boolean {
  return p.status === "DONE" || p.status === "FAILED";
}

/**
 * A devolução só pode sair quando o atendimento terminou — antes disso o pet
 * ainda está no banho. É o que separa "pronto para entregar" de "aguardando".
 */
export function devolucaoLiberada(p: ParadaRow): boolean {
  return p.kind === "DROPOFF" && p.appointmentStatus === "COMPLETED";
}

/**
 * As paradas do dia separadas pelo que o entregador pode fazer com cada uma.
 * Não é uma fila: ele escolhe a ordem, e cada grupo tem o seu botão.
 */
export type ParadasAgrupadas = {
  /** A caminho de uma casa — buscar ou devolver. */
  aCaminho: ParadaRow[];
  /** Pets no veículo, indo para o petshop. */
  comVoce: ParadaRow[];
  /** Buscas que ele ainda não começou. */
  paraBuscar: ParadaRow[];
  /** Devoluções com o atendimento pronto. */
  prontasParaEntregar: ParadaRow[];
  /** Devoluções com o pet ainda sendo atendido. */
  aguardandoAtendimento: ParadaRow[];
  encerradas: ParadaRow[];
};

export function agruparParadas(paradas: ParadaRow[]): ParadasAgrupadas {
  const g: ParadasAgrupadas = {
    aCaminho: [],
    comVoce: [],
    paraBuscar: [],
    prontasParaEntregar: [],
    aguardandoAtendimento: [],
    encerradas: [],
  };
  for (const p of paradas) {
    if (paradaEncerrada(p)) g.encerradas.push(p);
    else if (p.status === "EN_ROUTE") g.aCaminho.push(p);
    else if (p.status === "PICKED_UP") g.comVoce.push(p);
    else if (p.kind === "PICKUP") g.paraBuscar.push(p);
    else if (devolucaoLiberada(p)) g.prontasParaEntregar.push(p);
    else g.aguardandoAtendimento.push(p);
  }
  return g;
}

/**
 * A parada que importa agora, para os destaques (painel e mapa): a que já
 * está a caminho; senão a próxima que dá para fazer, na ordem do dia.
 */
export function paradaAtual(paradas: ParadaRow[]): ParadaRow | null {
  const g = agruparParadas(paradas);
  return g.aCaminho[0] ?? g.paraBuscar[0] ?? g.prontasParaEntregar[0] ?? null;
}

/**
 * Links de navegação por voz. O mapa do painel mostra onde ele está e o que
 * falta; quem guia na direção é o app que o entregador já usa — dirigir
 * olhando um mapa sem voz não é seguro.
 *
 * Com coordenada o destino é exato; sem ela, cai na busca por endereço, que é
 * o melhor que dá para fazer com um CEP que o Nominatim não reconheceu.
 */
export function linksDeNavegacao(parada: ParadaRow): {
  maps: string;
  waze: string;
} | null {
  if (parada.lat !== null && parada.lng !== null) {
    const ll = `${parada.lat},${parada.lng}`;
    return {
      maps: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    };
  }
  if (!parada.endereco) return null;
  const q = encodeURIComponent(parada.endereco);
  return {
    maps: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/**
 * Cadastro sem endereço nenhum. formatAddressLine já devolve null nesse caso
 * (é o hasAddress dele por dentro), então a pergunta é sobre a linha pronta —
 * não vale recalcular a regra aqui e arriscar as duas divergirem.
 */
export function semEndereco(parada: ParadaRow): boolean {
  return parada.endereco === null;
}
