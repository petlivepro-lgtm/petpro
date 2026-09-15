"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
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

/** Refaz o traçado só quando ele andou de verdade — cada refetch é uma chamada externa. */
const REFAZER_TRACADO_M = 150;

export type MapaRotaProps = {
  paradas: ParadaRow[];
  posicao: Posicao | null;
  destino: ParadaRow | null;
  className?: string;
};

export function MapaRota({ paradas, posicao, destino, className }: MapaRotaProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const camadaRef = useRef<LayerGroup | null>(null);
  const euRef = useRef<Marker | null>(null);
  const linhaRef = useRef<Polyline | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const seguindo = useRef(true);

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

  const comPonto = paradas.filter((p) => p.temPonto);

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
    })();

    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- pinos das paradas ---
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const camada = camadaRef.current;
    if (!L || !map || !camada) return;

    camada.clearLayers();

    for (const parada of comPonto) {
      const atual = destino?.id === parada.id;
      const feito = parada.status === "DONE";
      const cor = feito ? "#2E9E5B" : atual ? "#FF6A00" : "#1D4E5F";
      const icone = L.divIcon({
        className: "",
        html: `<div style="background:${cor};color:#fff;width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff"><span style="transform:rotate(45deg);font:600 12px/1 system-ui">${parada.position}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      L.marker([parada.lat!, parada.lng!], {
        icon: icone,
        // Buscar e devolver são o MESMO endereço, então os dois pinos caem um
        // sobre o outro. Sem isto, a parada seguinte (azul) cobre a da vez
        // (laranja) e o entregador vê o número errado no mapa.
        zIndexOffset: atual ? 500 : feito ? 0 : 100,
      })
        .bindPopup(
          `<strong>${parada.petName}</strong><br>${
            parada.kind === "PICKUP" ? "Buscar" : "Devolver"
          }<br>${parada.endereco ?? ""}`,
        )
        .addTo(camada);
    }

    if (!posicao && comPonto.length) {
      map.fitBounds(
        L.latLngBounds(comPonto.map((p) => [p.lat!, p.lng!] as [number, number])),
        { padding: [40, 40], maxZoom: 16 },
      );
    }
  }, [comPonto, destino, posicao]);

  // --- posição do entregador ---
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !posicao) return;

    const angulo = posicao.heading ?? 0;
    const html = `<div style="width:22px;height:22px;display:flex;align-items:center;justify-content:center"><div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:18px solid #FF6A00;transform:rotate(${angulo}deg);filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))"></div></div>`;
    const icone = L.divIcon({
      className: "",
      html,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });

    if (euRef.current) {
      euRef.current.setLatLng([posicao.lat, posicao.lng]);
      euRef.current.setIcon(icone);
    } else {
      euRef.current = L.marker([posicao.lat, posicao.lng], {
        icon: icone,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup("Você está aqui");
    }

    if (seguindo.current) {
      map.setView([posicao.lat, posicao.lng], Math.max(map.getZoom() ?? 15, 15), {
        animate: true,
      });
    }
  }, [posicao]);

  // --- traçado até a parada da vez ---
  useEffect(() => {
    if (!ancora || !destino?.temPonto) {
      linhaRef.current?.remove();
      linhaRef.current = null;
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
              { lat: destino.lat, lng: destino.lng },
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
        linhaRef.current = L.polyline(linha, {
          color: "#FF6A00",
          weight: 5,
          opacity: 0.85,
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
  }, [ancora, destino]);

  return (
    <div className={className}>
      <div
        ref={divRef}
        className="w-full rounded-xl"
        // O Leaflet mede o container na montagem; sem altura explícita aqui o
        // mapa nasce com 0px e só aparece depois de um resize manual.
        style={{ minHeight: 280 }}
      />
      {eta && (
        <p className="mt-2 text-sm text-gray-neutral">
          <span className="font-medium text-graphite">
            {Math.max(1, Math.round(eta.segundos / 60))} min
          </span>{" "}
          até a próxima parada · {(eta.metros / 1000).toFixed(1)} km
        </p>
      )}
    </div>
  );
}
