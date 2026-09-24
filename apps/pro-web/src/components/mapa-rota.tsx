"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  VEHICLE_MARKER_SIZE,
  animarMarcador,
  aparaTrajeto,
  cn,
  duracaoAdaptativa,
  shopMarkerHtml,
  vehicleMarkerHtml,
} from "@mylivepet/ui";
import type { DeliveryVehicle } from "@mylivepet/types";
import { metros, type Posicao } from "@/lib/use-geolocation";
import type { ParadaRow } from "@/lib/rotas";

/**
 * O mapa ao vivo da rota: onde o entregador está, para onde ele vai agora e o
 * caminho entre os dois.
 *
 * Leaflet puro, sem react-leaflet: são poucas camadas, todas imperativas
 * (mover um marcador, trocar uma linha), e o wrapper custaria uma dependência
 * a mais para reembalar exatamente isso. O import é dinâmico porque o Leaflet
 * toca em `window` já no topo do módulo e quebraria o render do servidor.
 *
 * Os ícones são divIcon com HTML da marca — os PNG padrão do Leaflet quebram
 * no bundler do Next (ele reescreve os caminhos) e teriam a cara de outro app.
 */

const TILES =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATRIBUICAO =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Nome de pet e endereço vêm de cadastro: escapados antes de virar HTML do balão. */
function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Refaz o traçado só quando ele andou de verdade — cada refetch é uma chamada externa. */
const REFAZER_TRACADO_M = 150;

export type PontoDestino = {
  lat: number;
  lng: number;
  rotulo: string;
  /** Destino sugerido, que ele ainda não escolheu: a linha sai tracejada. */
  sugestao?: boolean;
};

export type MapaRotaProps = {
  paradas: ParadaRow[];
  posicao: Posicao | null;
  /**
   * Para onde ele vai agora — uma casa, ou o petshop quando está com pets no
   * veículo. É até aqui que o traçado é desenhado.
   */
  destino: PontoDestino | null;
  /** Parada em destaque (pino laranja). */
  destaqueId?: string | null;
  /** Parada escolhida na lista: o mapa centraliza nela e abre o balão. */
  foco?: ParadaRow | null;
  petshop?: { lat: number; lng: number; nome: string } | null;
  veiculo?: DeliveryVehicle | null;
  className?: string;
};

export function MapaRota({
  paradas,
  posicao,
  destino,
  destaqueId,
  foco,
  petshop,
  veiculo,
  className,
}: MapaRotaProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const camadaRef = useRef<LayerGroup | null>(null);
  const euRef = useRef<Marker | null>(null);
  const linhaRef = useRef<Polyline | null>(null);
  /** O trajeto inteiro que veio do roteador — a linha visível é ele aparado. */
  const trajetoRef = useRef<[number, number][] | null>(null);
  const ultimaLeitura = useRef<number | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const seguindo = useRef(true);
  const marcadoresRef = useRef(new Map<string, Marker>());

  /**
   * O Leaflet chega por import dinâmico, então o mapa fica pronto DEPOIS do
   * primeiro render. Sem este estado os efeitos de pinos e posição rodavam com
   * o mapa ainda nulo, desistiam, e nada os acordava de novo — o mapa ficava
   * no zoom do Brasil sem pino nenhum.
   */
  const [pronto, setPronto] = useState(false);

  const [eta, setEta] = useState<{ segundos: number; metros: number } | null>(null);

  /**
   * Posição "âncora": a do traçado, que só muda quando ele anda de verdade.
   *
   * O marcador acompanha cada sinal do GPS (é o que faz a seta deslizar pela
   * rua), mas o traçado NÃO pode depender de `posicao` diretamente. O
   * watchPosition dispara a cada segundo; o efeito re-rodava a cada disparo, o
   * cleanup cancelava o fetch em voo, e a execução seguinte desistia por não
   * ter andado os 150m — de modo que a linha nunca terminava de ser buscada.
   * Ancorando aqui, o efeito só acorda quando há motivo para recalcular.
   */
  const [ancora, setAncora] = useState<Posicao | null>(null);
  useEffect(() => {
    if (!posicao) return;
    setAncora((anterior) =>
      !anterior ||
      metros(anterior.lat, anterior.lng, posicao.lat, posicao.lng) >= REFAZER_TRACADO_M
        ? posicao
        : anterior,
    );
  }, [posicao]);

  // Memorizado: um array novo a cada render re-rodaria o efeito dos pinos (e
  // o fitBounds) sempre que o pai mudasse qualquer estado, desfazendo o foco.
  const comPonto = useMemo(() => paradas.filter((p) => p.temPonto), [paradas]);

  // --- monta o mapa uma vez ---
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !divRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(divRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer(TILES, { attribution: ATRIBUICAO, maxZoom: 19 }).addTo(map);
      map.setView([-14.235, -51.925], 4); // Brasil, até termos um ponto real
      camadaRef.current = L.layerGroup().addTo(map);

      // Arrastar o mapa desliga o "seguir": o entregador quer olhar a rua
      // seguinte sem o mapa puxá-lo de volta a cada atualização do GPS.
      map.on("dragstart", () => {
        seguindo.current = false;
      });

      mapRef.current = map;
      setPronto(true);
    })();

    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setPronto(false);
    };
  }, []);

  // Primitivos, e não o objeto: o pai monta `destino` a cada render, e o
  // efeito do traçado (que custa uma chamada externa) só deve acordar quando
  // o ponto muda de verdade.
  const destLat = destino?.lat ?? null;
  const destLng = destino?.lng ?? null;
  const destSugestao = destino?.sugestao ?? false;

  // Booleano, e não a posição: redesenhar todos os pinos a cada sinal do GPS
  // seria desperdício — só importa saber se já existe posição.
  const temPosicao = posicao !== null;

  // --- pinos das paradas ---
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const camada = camadaRef.current;
    if (!L || !map || !camada) return;

    camada.clearLayers();
    marcadoresRef.current.clear();

    for (const parada of comPonto) {
      const atual = destaqueId === parada.id;
      // Pet já no veículo: a casa dele não é mais destino de nada hoje.
      const feito = parada.status === "DONE" || parada.status === "PICKED_UP";
      const cor = feito ? "#2E9E5B" : atual ? "#FF6A00" : "#1D4E5F";
      const icone = L.divIcon({
        className: "",
        html: `<div style="background:${cor};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff"><span style="transform:rotate(45deg);font:600 12px/1 system-ui">${parada.position}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const marcador = L.marker([parada.lat!, parada.lng!], {
        icon: icone,
        // Buscar e devolver são o MESMO endereço, então os dois pinos caem um
        // sobre o outro. Sem isto, a parada seguinte (azul) cobre a da vez
        // (laranja) e o entregador vê o número errado no mapa.
        zIndexOffset: atual ? 500 : feito ? 0 : 100,
      })
        .bindPopup(
          `<strong>${esc(parada.petName)}</strong><br>${
            parada.kind === "PICKUP" ? "Buscar" : "Devolver"
          }<br>${esc(parada.endereco ?? "")}`,
        )
        .addTo(camada);
      marcadoresRef.current.set(parada.id, marcador);
    }

    if (petshop) {
      L.marker([petshop.lat, petshop.lng], {
        icon: L.divIcon({
          className: "",
          html: shopMarkerHtml(),
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        zIndexOffset: 50,
      })
        .bindPopup(`<strong>${esc(petshop.nome)}</strong><br>Petshop`)
        .addTo(camada);
    }

    const pontos: [number, number][] = comPonto.map((p) => [p.lat!, p.lng!]);
    if (petshop) pontos.push([petshop.lat, petshop.lng]);
    // Com GPS, quem enquadra é a posição dele; sem, o dia inteiro.
    if (!temPosicao && pontos.length) {
      map.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 16 });
    }
  }, [pronto, comPonto, destaqueId, petshop, temPosicao]);

  // --- parada escolhida na lista ---
  useEffect(() => {
    const map = mapRef.current;
    if (!pronto || !map || !foco?.temPonto) return;
    // Olhar outra parada é o mesmo gesto de arrastar: para de seguir o GPS.
    seguindo.current = false;
    map.setView([foco.lat!, foco.lng!], Math.max(map.getZoom() ?? 16, 16), {
      animate: true,
    });
    marcadoresRef.current.get(foco.id)?.openPopup();
  }, [pronto, foco]);

  // --- posição do entregador ---
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !posicao) return;

    const icone = L.divIcon({
      className: "",
      html: vehicleMarkerHtml(veiculo, posicao.heading),
      iconSize: [VEHICLE_MARKER_SIZE, VEHICLE_MARKER_SIZE],
      iconAnchor: [VEHICLE_MARKER_SIZE / 2, VEHICLE_MARKER_SIZE / 2],
    });

    if (euRef.current) {
      euRef.current.setIcon(icone);
      // Desliza no compasso em que o GPS entrega (~1s em movimento), e a
      // linha encolhe junto, a cada quadro, grudada no ícone.
      const duracao = duracaoAdaptativa(ultimaLeitura, 500, 3_000);
      animarMarcador(euRef.current, posicao, duracao, (lat, lng) => {
        if (trajetoRef.current && linhaRef.current) {
          linhaRef.current.setLatLngs(aparaTrajeto(trajetoRef.current, lat, lng));
        }
      });
    } else {
      euRef.current = L.marker([posicao.lat, posicao.lng], {
        icon: icone,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup("Você está aqui");
    }

    if (seguindo.current) {
      // Com destino, enquadra os dois — ele e para onde vai, como no Uber.
      // Sem destino, centraliza nele no zoom de rua.
      if (destLat !== null && destLng !== null) {
        map.fitBounds(
          L.latLngBounds([
            [posicao.lat, posicao.lng],
            [destLat, destLng],
          ]),
          { padding: [60, 60], maxZoom: 17, animate: true },
        );
      } else {
        map.setView([posicao.lat, posicao.lng], Math.max(map.getZoom() ?? 15, 15), {
          animate: true,
        });
      }
    }
  }, [pronto, posicao, veiculo, destLat, destLng]);

  // --- traçado até o destino ---
  useEffect(() => {
    if (!ancora || destLat === null || destLng === null) {
      linhaRef.current?.remove();
      linhaRef.current = null;
      trajetoRef.current = null;
      setEta(null);
      return;
    }

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch("/api/rota", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pontos: [
              { lat: ancora.lat, lng: ancora.lng },
              { lat: destLat, lng: destLng },
            ],
          }),
        });
        if (!res.ok || cancelado) return;
        const {
          linha,
          segundos,
          metros: dist,
        } = (await res.json()) as {
          linha: [number, number][];
          segundos: number;
          metros: number;
        };

        const L = LRef.current;
        const map = mapRef.current;
        if (!L || !map || cancelado) return;

        linhaRef.current?.remove();
        trajetoRef.current = linha;
        // O traçado foi pedido a partir da âncora, que pode estar até 150m
        // atrás: já nasce aparado a partir de onde a moto está agora.
        const aqui = euRef.current?.getLatLng();
        linhaRef.current = L.polyline(aqui ? aparaTrajeto(linha, aqui.lat, aqui.lng) : linha, {
          color: "#FF6A00",
          weight: 5,
          opacity: destSugestao ? 0.6 : 0.85,
          dashArray: destSugestao ? "2 10" : undefined,
          lineCap: "round",
        }).addTo(map);
        setEta({ segundos, metros: dist });
      } catch {
        // Roteador fora do ar: os pinos e a posição continuam de pé, que é o
        // que basta para o entregador seguir com o Waze.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ancora, destLat, destLng, destSugestao]);

  return (
    <div className={cn("flex flex-col", className)}>
      <div
        ref={divRef}
        // flex-1: quem usa o mapa decide a altura pela className de fora.
        // isolate: as camadas do Leaflet usam z-index 400–1000 e, sem um
        // contexto próprio, passariam por cima do cabeçalho e da barra fixa.
        className="isolate w-full flex-1 rounded-xl"
        // O Leaflet mede o container na montagem; sem altura explícita aqui o
        // mapa nasce com 0px e só aparece depois de um resize manual.
        style={{ minHeight: 280 }}
      />
      {eta && (
        <p className="mt-2 text-sm text-gray-neutral">
          <span className="font-medium text-graphite">
            {Math.max(1, Math.round(eta.segundos / 60))} min
          </span>{" "}
          até {destino?.rotulo ?? "o destino"} · {(eta.metros / 1000).toFixed(1)} km
        </p>
      )}
    </div>
  );
}
