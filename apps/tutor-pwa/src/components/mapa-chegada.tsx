"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  VEHICLE_MARKER_SIZE,
  animarMarcador,
  aparaTrajeto,
  duracaoAdaptativa,
  vehicleMarkerHtml,
} from "@mylivepet/ui";
import type { DeliveryVehicle } from "@mylivepet/types";
import { distanciaEmMetros } from "@/lib/chegada";

/**
 * O mapa que o tutor vê enquanto alguém vai buscar (ou devolver) o pet: os
 * dois pinos e o caminho entre eles.
 *
 * É de propósito mais simples que o mapa do entregador: aqui ninguém precisa
 * da ordem das paradas nem dos botões de ação — a pergunta é só "está longe
 * ainda?". O traçado existe porque a linha responde essa pergunta melhor que
 * qualquer número: dá para ver o quanto falta e por onde ele vem.
 */

const TILES =
  process.env.NEXT_PUBLIC_MAP_TILES_URL ||
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const ATRIBUICAO =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** Só refaz o traçado quando o entregador andou de verdade. */
const REFAZER_TRACADO_M = 150;

type Ponto = { lat: number; lng: number };

export function MapaChegada({
  entregador,
  destino,
  className,
}: {
  entregador: (Ponto & { heading?: number | null; veiculo?: DeliveryVehicle | null }) | null;
  destino: Ponto | null;
  className?: string;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const entregadorRef = useRef<Marker | null>(null);
  const destinoRef = useRef<Marker | null>(null);
  const linhaRef = useRef<Polyline | null>(null);
  /** O trajeto inteiro que veio do roteador — a linha visível é ele aparado. */
  const trajetoRef = useRef<[number, number][] | null>(null);
  const ultimaChegada = useRef<number | null>(null);
  const enquadrou = useRef(false);

  // Âncora do traçado: a posição chega pelo Realtime a cada poucos segundos, e
  // refazer a rota a cada metro seria uma chamada externa por nada.
  const [ancora, setAncora] = useState<Ponto | null>(null);
  useEffect(() => {
    if (!entregador) return;
    setAncora((anterior) =>
      !anterior ||
      distanciaEmMetros(anterior.lat, anterior.lng, entregador.lat, entregador.lng) >=
        REFAZER_TRACADO_M
        ? entregador
        : anterior,
    );
  }, [entregador]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelado || !divRef.current || mapRef.current) return;
      LRef.current = L;

      // Com zoom: o tutor quer poder afastar para entender o trajeto inteiro e
      // aproximar para ver em que rua ele está.
      const map = L.map(divRef.current, { zoomControl: true });
      L.tileLayer(TILES, { attribution: ATRIBUICAO, maxZoom: 19 }).addTo(map);
      map.setView([-14.235, -51.925], 4);
      mapRef.current = map;
    })();

    return () => {
      cancelado = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- pinos ---
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const pino = (cor: string, emoji: string) =>
      L.divIcon({
        className: "",
        html: `<div style="background:${cor};width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3);font-size:14px">${emoji}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });

    if (destino) {
      const icone = pino("#1D4E5F", "🏠");
      if (destinoRef.current) destinoRef.current.setLatLng([destino.lat, destino.lng]);
      else
        destinoRef.current = L.marker([destino.lat, destino.lng], { icon: icone })
          .addTo(map)
          .bindPopup("Seu endereço");
    }

    if (entregador) {
      // Mesmo ícone do mapa do entregador: moto, bicicleta ou carro.
      const icone = L.divIcon({
        className: "",
        html: vehicleMarkerHtml(entregador.veiculo, entregador.heading),
        iconSize: [VEHICLE_MARKER_SIZE, VEHICLE_MARKER_SIZE],
        iconAnchor: [VEHICLE_MARKER_SIZE / 2, VEHICLE_MARKER_SIZE / 2],
      });
      if (entregadorRef.current) {
        entregadorRef.current.setIcon(icone);
        // A posição chega a cada ~15m andados — de 1s a 4s conforme a
        // velocidade. Desliza o tempo que a última demorou, para o ícone não
        // parar entre uma e outra; a linha encolhe atrás dele.
        const duracao = duracaoAdaptativa(ultimaChegada, 1_000, 8_000);
        animarMarcador(entregadorRef.current, entregador, duracao, (lat, lng) => {
          if (trajetoRef.current && linhaRef.current) {
            linhaRef.current.setLatLngs(aparaTrajeto(trajetoRef.current, lat, lng));
          }
        });
      } else {
        entregadorRef.current = L.marker([entregador.lat, entregador.lng], {
          icon: icone,
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup("Entregador do petshop");
      }
    }

    // Enquadra uma vez só. Refazer isso a cada atualização puxaria o mapa de
    // volta enquanto o tutor está arrastando ou aproximando — o traçado, mais
    // abaixo, é quem reenquadra quando o caminho muda de verdade.
    if (enquadrou.current) return;
    const pontos = [entregador, destino].filter(Boolean) as Ponto[];
    if (pontos.length === 2) {
      map.fitBounds(
        L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [50, 50], maxZoom: 15 },
      );
      enquadrou.current = true;
    } else if (pontos.length === 1) {
      // Zoom 14, e não 15: com um ponto só não há distância a mostrar, e o
      // bairro em volta situa melhor que a quadra.
      map.setView([pontos[0]!.lat, pontos[0]!.lng], 14);
    }
  }, [entregador, destino]);

  // --- traçado ---
  useEffect(() => {
    if (!ancora || !destino) {
      linhaRef.current?.remove();
      linhaRef.current = null;
      trajetoRef.current = null;
      return;
    }

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch("/api/rota", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pontos: [ancora, destino] }),
        });
        if (!res.ok || cancelado) return;
        const { linha } = (await res.json()) as { linha: [number, number][] };

        const L = LRef.current;
        const map = mapRef.current;
        if (!L || !map || cancelado) return;

        linhaRef.current?.remove();
        trajetoRef.current = linha;
        const aqui = entregadorRef.current?.getLatLng();
        linhaRef.current = L.polyline(aqui ? aparaTrajeto(linha, aqui.lat, aqui.lng) : linha, {
          color: "#FF6A00",
          weight: 5,
          opacity: 0.85,
        }).addTo(map);

        // O caminho inteiro na tela — é o enquadramento que responde "quanto
        // falta" de um olhar só.
        map.fitBounds(linhaRef.current.getBounds(), {
          padding: [40, 40],
          maxZoom: 16,
        });
        enquadrou.current = true;
      } catch {
        // Roteador fora do ar: ficam os dois pinos, que já dizem a distância.
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ancora, destino]);

  return (
    <div
      ref={divRef}
      className={className}
      // O Leaflet mede o container ao montar; sem altura explícita ele nasce
      // com 0px e o mapa não aparece.
      style={{ minHeight: 280 }}
    />
  );
}
