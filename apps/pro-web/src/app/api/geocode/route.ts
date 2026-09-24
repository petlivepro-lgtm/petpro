import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAddress, type AddressParts } from "@mylivepet/types";
import { consultarNominatim as consultar } from "@/lib/nominatim";

/**
 * Endereço → coordenada, para as paradas da rota (0062).
 *
 * POR QUE EXISTE UM PROXY, e não um fetch direto do navegador como o ViaCEP do
 * CepInput: a política do Nominatim exige um User-Agent identificável em toda
 * chamada, e o navegador não deixa definir esse header. Sem ele a resposta é
 * 403 — testado.
 *
 * O resultado é gravado em dois lugares: na parada (é o que o mapa lê) e no
 * cadastro de origem (tutor.lat/lng ou pet.lat/lng), que é o cache — o trigger
 * da 0062 zera esse cache sozinho quando o endereço muda.
 *
 * Falhar aqui nunca é fatal: parada sem coordenada continua na lista com o
 * endereço escrito e o botão do Waze por busca textual.
 */

// A política do Nominatim pede no máximo 1 requisição por segundo.
const INTERVALO_MS = 1_100;

/**
 * Teto por chamada. Com 1 req/s, mais que isto e o cliente espera dez segundos
 * pela resposta. O que sobrar é resolvido na próxima passada — e, na prática,
 * só a primeira parada de cada cliente custa: a coordenada fica no cadastro.
 */
const MAX_POR_VEZ = 8;

type Resultado =
  | { stop_id: string; lat: number; lng: number }
  | { stop_id: string; erro: string };

/**
 * As consultas que serão tentadas, em ordem, para um endereço.
 *
 * CONSULTA ESTRUTURADA, e não a linha que aparece na tela. Esta distinção
 * derrubou a primeira versão: passar `formatAddressLine` aqui parecia
 * natural — é o endereço, afinal — mas aquela função escreve para gente ler,
 * com travessão entre as partes, "casa 3" no meio e "São Gonçalo/RJ" com
 * barra. O Nominatim devolve VAZIO para isso e acha o mesmo endereço na hora
 * quando os campos vêm separados (testado com o endereço real de um cliente).
 *
 * O complemento nunca entra: "casa 3", "fundos" e "apto 501" não existem no
 * mapa e só atrapalham a busca.
 *
 * A segunda tentativa tira o número, que é a parte que o OSM mais costuma não
 * ter mapeada; a rua inteira já põe o pino na quadra certa. Não há terceira
 * tentativa por bairro ou cidade de propósito: um pino no centro do bairro
 * parece preciso sem ser, e pior — o botão "Navegar" passaria a mandar o
 * entregador para lá em vez de deixar o Waze buscar o endereço escrito.
 */
function consultasPara(p: AddressParts): URLSearchParams[] {
  const rua = p.street?.trim();
  const cidade = p.city?.trim();
  if (!rua || !cidade) return [];

  const numero = p.street_number?.trim();
  const uf = p.state?.trim();

  const base: Record<string, string> = {
    format: "jsonv2",
    limit: "1",
    country: "Brasil",
    city: cidade,
  };
  if (uf) base.state = uf;

  const tentativas: Record<string, string>[] = [];
  // "102 Rua Nestor Moreira": o Nominatim espera o número ANTES do logradouro
  // no campo `street`, à moda anglófona, mesmo para endereços brasileiros.
  if (numero) tentativas.push({ ...base, street: `${numero} ${rua}` });
  tentativas.push({ ...base, street: rua });

  return tentativas.map((t) => new URLSearchParams(t));
}

const espera = () => new Promise((r) => setTimeout(r, INTERVALO_MS));

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { stop_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const ids = (body.stop_ids ?? []).slice(0, MAX_POR_VEZ);
  if (!ids.length) return NextResponse.json({ resultados: [] });

  // Lê pela RLS, de propósito: se a parada não é dele, ela simplesmente não
  // volta — a autorização é a mesma que vale para a tela.
  const { data: paradas } = await supabase
    .from("delivery_stop_card")
    .select(
      "id, appointment_id, cep, street, street_number, complement, district, city, state, lat, lng",
    )
    .in("id", ids);

  const admin = createAdminClient();
  const resultados: Resultado[] = [];

  for (const parada of paradas ?? []) {
    if (parada.lat !== null && parada.lng !== null) continue; // já tem ponto

    const tentativas = consultasPara(parada);
    if (!tentativas.length) {
      resultados.push({ stop_id: parada.id!, erro: "endereço sem rua ou cidade" });
      continue;
    }

    let ponto: { lat: number; lng: number } | null = null;
    for (const params of tentativas) {
      ponto = await consultar(params);
      await espera();
      if (ponto) break;
    }

    if (!ponto) {
      resultados.push({ stop_id: parada.id!, erro: "não encontrado" });
      continue;
    }

    await admin
      .from("delivery_stop")
      .update({ lat: ponto.lat, lng: ponto.lng })
      .eq("id", parada.id!);

    await gravarCache(admin, parada.appointment_id!, ponto);
    resultados.push({ stop_id: parada.id!, ...ponto });
  }

  return NextResponse.json({ resultados });
}

/**
 * Guarda a coordenada no cadastro que forneceu o endereço, para a próxima rota
 * não precisar consultar de novo. Qual cadastro é esse segue a regra da 0059:
 * pet com endereço próprio responde por ele; sem isso, é do tutor.
 */
async function gravarCache(
  admin: ReturnType<typeof createAdminClient>,
  appointmentId: string,
  ponto: { lat: number; lng: number },
) {
  const { data: appt } = await admin
    .from("appointment")
    .select("pet_id, tutor_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (!appt) return;

  const { data: pet } = await admin
    .from("pet")
    .select("id, cep, street, street_number, complement, district, city, state")
    .eq("id", appt.pet_id)
    .maybeSingle();

  const campos = { ...ponto, geocoded_at: new Date().toISOString() };

  if (pet && hasAddress(pet)) {
    await admin.from("pet").update(campos).eq("id", pet.id);
    return;
  }
  await admin.from("tutor").update(campos).eq("id", appt.tutor_id);
}
