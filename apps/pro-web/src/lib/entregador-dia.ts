import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import { consultarNominatim } from "@/lib/nominatim";
import { fetchRota, hojeKey, type RotaDoDia } from "@/lib/rotas";
import { createAdminClient } from "@/lib/supabase/admin";

const TZ = "America/Sao_Paulo";

/** "quinta-feira, 24 de setembro" — no fuso do petshop. */
export function hojePorExtenso(d = new Date()): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  });
}

/**
 * Dia da semana (0 = domingo) e "HH:mm" de agora, no fuso do petshop. O
 * servidor roda em UTC: `new Date().getDay()` viraria o dia às 21h.
 */
export function agoraSP(d = new Date()): { weekday: number; hhmm: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: TZ,
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return { weekday: dias.indexOf(get("weekday")), hhmm: `${get("hour")}:${get("minute")}` };
}

/**
 * O que as duas telas do entregador precisam para abrir: o cadastro dele e a
 * rota de hoje, já montada.
 *
 * Nenhuma query filtra por colaborador: a RLS da 0062 já entrega só a rota
 * dele, as paradas dela e o cadastro dele.
 */
export async function carregarDiaDoEntregador(supabase: SupabaseClient<Database>) {
  const dia = hojeKey();

  const { data: me } = await supabase
    .from("collaborator")
    .select(
      "id, tenant_id, full_name, role_title, vehicle, collaborator_schedule(weekday, start_time, end_time)",
    )
    .maybeSingle();

  // Monta a rota do dia ao abrir a tela. É a "auto-rota": o petshop marca
  // buscar/devolver no agendamento e ninguém precisa montar lista nenhuma à
  // mão. A RPC é idempotente de propósito — chamar a cada visita recalcula o
  // que ainda está pendente e não toca no que já aconteceu.
  if (me) {
    await supabase.rpc("build_delivery_route", { _collaborator: me.id, _date: dia });
  }

  const [rota, petshop] = await Promise.all([
    fetchRota(supabase, dia) as Promise<RotaDoDia>,
    me ? localDoPetshop(me.tenant_id) : Promise.resolve(null),
  ]);
  return { me, rota, dia, petshop };
}

export type LocalPetshop = { nome: string; endereco: string; lat: number; lng: number };

type GeoCache = { address: string; lat: number | null; lng: number | null };

/**
 * Onde fica o petshop — o destino de todo pet buscado.
 *
 * O endereço do petshop é texto livre (configurações → `settings.address`),
 * então a coordenada sai de uma busca textual no Nominatim, guardada em
 * `settings.shop_geo` junto com o endereço que a gerou. Mudou o endereço, o
 * cache não bate e a busca roda de novo; não achou, o fracasso também fica
 * guardado — sem isso cada abertura de tela esperaria o Nominatim de novo.
 *
 * Admin client: o entregador lê o tenant, mas não pode escrever nele.
 */
async function localDoPetshop(tenantId: string): Promise<LocalPetshop | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("tenant")
    .select("name, settings")
    .eq("id", tenantId)
    .maybeSingle();
  if (!data) return null;

  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const endereco = typeof settings.address === "string" ? settings.address.trim() : "";
  if (!endereco) return null;

  let geo = settings.shop_geo as GeoCache | undefined;
  if (!geo || geo.address !== endereco) {
    const ponto = await consultarNominatim(
      new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", q: endereco }),
    );
    geo = { address: endereco, lat: ponto?.lat ?? null, lng: ponto?.lng ?? null };
    await admin
      .from("tenant")
      .update({ settings: { ...settings, shop_geo: geo } })
      .eq("id", tenantId);
  }

  if (geo.lat === null || geo.lng === null) return null;
  return { nome: data.name, endereco, lat: geo.lat, lng: geo.lng };
}
