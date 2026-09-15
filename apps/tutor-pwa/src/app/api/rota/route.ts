import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Traçado e tempo de viagem entre dois pontos do mapa de chegada.
 *
 * Par do handler de mesmo nome no pro-web, e duplicado de propósito: são dois
 * apps Next independentes, e o repo já resolve assim o que os dois precisam do
 * servidor (ver os lib/notify.ts idênticos). Compartilhar exigiria um pacote
 * só para setenta linhas que quase nunca mudam.
 *
 * Passa pelo servidor por dois motivos: trocar de provedor um dia sem mexer em
 * nenhuma tela, e não expor no bundle a URL de um serviço que pode vir a ter
 * chave. O OSRM público não tem SLA — se ele cair, o tutor continua vendo os
 * dois pinos, que já respondem "está longe ainda?".
 */

const OSRM = "https://router.project-osrm.org/route/v1/driving";

/** Teto de pontos: rota de um dia de petshop tem dezenas, não centenas. */
const MAX_PONTOS = 25;

type Ponto = { lat: number; lng: number };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { pontos?: Ponto[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const pontos = (body.pontos ?? []).slice(0, MAX_PONTOS);
  if (pontos.length < 2) {
    return NextResponse.json({ error: "pontos insuficientes" }, { status: 400 });
  }

  // OSRM fala em lng,lat — a ordem trocada devolve uma rota no meio do oceano.
  const coords = pontos.map((p) => `${p.lng},${p.lat}`).join(";");

  try {
    const res = await fetch(
      `${OSRM}/${coords}?overview=full&geometries=geojson&steps=false`,
      { signal: AbortSignal.timeout(8_000), cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ error: "roteador indisponível" }, { status: 502 });

    const json = (await res.json()) as {
      routes?: {
        duration: number;
        distance: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };
    const rota = json.routes?.[0];
    if (!rota) return NextResponse.json({ error: "sem rota" }, { status: 404 });

    return NextResponse.json({
      // Devolvido já em lat,lng: é o que o Leaflet espera, e converter aqui
      // evita a mesma inversão repetida em cada componente de mapa.
      linha: rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      segundos: Math.round(rota.duration),
      metros: Math.round(rota.distance),
    });
  } catch {
    return NextResponse.json({ error: "roteador indisponível" }, { status: 502 });
  }
}
