import type { AddressParts } from "@mylivepet/types";

/**
 * Consulta ao Nominatim (OpenStreetMap), só no servidor.
 *
 * A política do Nominatim exige um User-Agent que identifique a aplicação e
 * dê como falar com ela — o navegador não deixa definir esse header, por isso
 * toda consulta passa por aqui. Também pede no máximo 1 requisição por
 * segundo: quem chama em sequência espaça as chamadas.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "PetLivePro/1.0 (leva-e-traz; contato@petlivepro.com.br)";

/** Primeiro resultado da busca, ou null se não achou ou a rede falhou. */
export async function consultarNominatim(
  params: URLSearchParams,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`${NOMINATIM}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat?: string; lon?: string }[];
    const primeiro = json?.[0];
    if (!primeiro?.lat || !primeiro?.lon) return null;
    return { lat: Number(primeiro.lat), lng: Number(primeiro.lon) };
  } catch {
    return null; // rede do petshop bloqueando, timeout, resposta estranha
  }
}

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
export function consultasEstruturadas(p: AddressParts): URLSearchParams[] {
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
