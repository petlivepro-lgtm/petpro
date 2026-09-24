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
