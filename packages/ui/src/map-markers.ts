import type { DeliveryVehicle } from "@mylivepet/types";

/**
 * HTML dos marcadores do leva-e-traz, para `L.divIcon`.
 *
 * Moram aqui, e não em cada app, porque o entregador (pro-web) e o tutor
 * (tutor-pwa) precisam ver o MESMO ícone — é o que faz o tutor reconhecer no
 * mapa dele a moto que o entregador vê no dele.
 *
 * String e não componente: o Leaflet recebe HTML cru no divIcon. Os traços
 * são no estilo do lucide (24×24, stroke 2) para combinar com o resto da
 * interface.
 */

const LARANJA = "#FF6A00";
const PETROLEO = "#1D4E5F";

const TRACOS: Record<DeliveryVehicle, string> = {
  MOTORCYCLE:
    '<circle cx="5" cy="16" r="3"/><circle cx="19" cy="16" r="3"/><path d="M8 16h5l3-5"/><path d="M9 11h5"/><path d="M16 11l-1.5-4H17"/><path d="M16 11l3 5"/>',
  BICYCLE:
    '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  CAR:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
};

const LOJA =
  '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>';

function svg(tracos: string, tamanho: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${tracos}</svg>`;
}

/** Lado do marcador do veículo, em px — para o iconSize/iconAnchor do Leaflet. */
export const VEHICLE_MARKER_SIZE = 40;

/**
 * O entregador no mapa: um círculo com o veículo dentro e uma pontinha na
 * borda apontando para onde ele vai.
 *
 * Só a pontinha gira, nunca o desenho: uma moto girada 180° ficaria de cabeça
 * para baixo. Sem direção (parado, ou GPS que não informa), a pontinha some.
 */
export function vehicleMarkerHtml(
  vehicle: DeliveryVehicle | null | undefined,
  heading?: number | null,
): string {
  const s = VEHICLE_MARKER_SIZE;
  const ponta =
    heading === null || heading === undefined
      ? ""
      : `<div style="position:absolute;inset:0;transform:rotate(${heading}deg)"><div style="position:absolute;left:50%;top:-8px;margin-left:-6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:9px solid ${LARANJA}"></div></div>`;
  return `<div style="position:relative;width:${s}px;height:${s}px">${ponta}<div style="position:absolute;inset:0;border-radius:50%;background:${LARANJA};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">${svg(TRACOS[vehicle ?? "MOTORCYCLE"], 20)}</div></div>`;
}

/** O mínimo de um marcador do Leaflet que a animação usa — sem importar o Leaflet aqui. */
type MarcadorMovel = {
  getLatLng(): { lat: number; lng: number };
  setLatLng(ll: [number, number]): unknown;
};

const animacoes = new WeakMap<MarcadorMovel, number>();

/**
 * Desliza o marcador até o novo ponto em vez de pular — o GPS chega aos
 * saltos (1s no aparelho do entregador, ~15m no mapa do tutor), e o salto
 * seco faz parecer que a moto se teletransporta.
 *
 * Linear, e não com easing: as leituras chegam em sequência, e acelerar e
 * frear a cada uma faria a moto andar "aos soquinhos". Uma animação nova
 * cancela a que estiver em curso, partindo de onde o marcador está agora.
 *
 * `aCadaQuadro` recebe a posição intermediária — é o que deixa a linha do
 * trajeto grudada no ícone durante o movimento.
 */
export function animarMarcador(
  marcador: MarcadorMovel,
  destino: { lat: number; lng: number },
  duracaoMs: number,
  aCadaQuadro?: (lat: number, lng: number) => void,
): void {
  const anterior = animacoes.get(marcador);
  if (anterior !== undefined) cancelAnimationFrame(anterior);

  const inicio = marcador.getLatLng();
  const dLat = destino.lat - inicio.lat;
  const dLng = destino.lng - inicio.lng;
  // Salto grande demais (GPS recalibrando, aba que voltou do segundo plano):
  // deslizar quilômetros pela tela seria mentir o trajeto. Vai direto.
  const longe = Math.abs(dLat) > 0.01 || Math.abs(dLng) > 0.01;
  if (longe || duracaoMs <= 0 || typeof requestAnimationFrame === "undefined") {
    marcador.setLatLng([destino.lat, destino.lng]);
    aCadaQuadro?.(destino.lat, destino.lng);
    return;
  }

  const t0 = performance.now();
  const passo = (agora: number) => {
    const t = Math.min(1, (agora - t0) / duracaoMs);
    const lat = inicio.lat + dLat * t;
    const lng = inicio.lng + dLng * t;
    marcador.setLatLng([lat, lng]);
    aCadaQuadro?.(lat, lng);
    if (t < 1) animacoes.set(marcador, requestAnimationFrame(passo));
    else animacoes.delete(marcador);
  };
  animacoes.set(marcador, requestAnimationFrame(passo));
}

/**
 * Quanto a próxima animação deve durar: o intervalo entre esta atualização e
 * a anterior. A melhor previsão de quando vem a próxima é quanto demorou a
 * última — deslizando esse tempo, o ícone termina um trecho quando o seguinte
 * já chegou e anda sem parar, ao custo de mostrar a posição de um intervalo
 * atrás (a mesma troca que o Uber faz).
 *
 * Os limites protegem dos extremos: o mínimo evita deslizes secos quando duas
 * leituras chegam coladas; o máximo, que um intervalo longo (parado no
 * semáforo, sinal perdido) vire um deslize lento demais quando ele arrancar.
 */
export function duracaoAdaptativa(
  ultimaChegada: { current: number | null },
  minMs: number,
  maxMs: number,
): number {
  const agora = typeof performance !== "undefined" ? performance.now() : Date.now();
  const anterior = ultimaChegada.current;
  ultimaChegada.current = agora;
  if (anterior === null) return minMs;
  return Math.min(maxMs, Math.max(minMs, agora - anterior));
}

/**
 * O trajeto a partir de onde a moto está: descarta o trecho já percorrido,
 * como a linha do Uber que vai encolhendo. Procura o vértice mais próximo da
 * posição e liga a posição a partir dali.
 *
 * Distância em graus ao quadrado, sem Haversine: só compara pontos a poucos
 * quarteirões uns dos outros, onde a distorção não muda qual é o mais perto.
 */
export function aparaTrajeto(
  linha: [number, number][],
  lat: number,
  lng: number,
): [number, number][] {
  if (linha.length < 2) return linha;
  let melhor = 0;
  let menor = Infinity;
  for (let i = 0; i < linha.length; i++) {
    const [a, b] = linha[i]!;
    const d = (a - lat) ** 2 + (b - lng) ** 2;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  }
  return [[lat, lng], ...linha.slice(melhor + 1)];
}

/** O petshop no mapa: para onde levar os pets buscados. */
export function shopMarkerHtml(): string {
  return `<div style="width:34px;height:34px;border-radius:10px;background:${PETROLEO};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center">${svg(LOJA, 18)}</div>`;
}
