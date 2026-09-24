"use client";

import { useCallback, useMemo } from "react";
import { PackageCheck, Truck } from "lucide-react";
import { Card, EmptyState } from "@mylivepet/ui";
import { MapaChegada } from "@/components/mapa-chegada";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import {
  chegadaAtiva,
  distanciaEmMetros,
  fetchChegadas,
  fetchPosicao,
  type Chegada,
  type PosicaoEntregador,
} from "@/lib/chegada";

/**
 * "Está chegando?" — a tela que o tutor abre quando o petshop vai buscar ou
 * devolver o pet.
 *
 * Duas assinaturas de realtime, porque são duas perguntas com ritmos
 * diferentes: a parada muda de status poucas vezes no dia, e a posição do
 * entregador muda a cada quarteirão.
 *
 * Quando não há ninguém a caminho, a tela diz isso com todas as letras. O mapa
 * vazio seria pior do que nenhum mapa: passaria a ideia de que o entregador
 * sumiu, quando na verdade ele nem saiu ainda.
 */
export function ChegandoSection({
  chegadas: inicial,
  posicao: posicaoInicial,
}: {
  chegadas: Chegada[];
  posicao: PosicaoEntregador | null;
}) {
  const fetcherChegadas = useCallback(() => fetchChegadas(createClient()), []);
  const chegadas = useRealtimeList(
    inicial,
    fetcherChegadas,
    [{ table: "delivery_stop" }],
    "chegada-paradas",
  );

  const ativa = useMemo(() => chegadaAtiva(chegadas), [chegadas]);

  const fetcherPosicao = useCallback(async () => {
    if (!ativa) return [];
    const p = await fetchPosicao(createClient(), ativa.routeId);
    return p ? [p] : [];
  }, [ativa]);

  // Sem syncKey (o hook daqui não tem o parâmetro do pro-web): quando a parada
  // ativa troca, a posição só se ajusta no próximo sinal do GPS. Como ele chega
  // a cada ~15s enquanto a rota corre, a defasagem é de um piscar — e trocar de
  // parada no meio do trajeto é raro.
  const posicoes = useRealtimeList(
    posicaoInicial ? [posicaoInicial] : [],
    fetcherPosicao,
    [{ table: "delivery_position" }],
    "chegada-posicao",
  );
  const posicao = posicoes[0] ?? null;

  // PICKED_UP entra junto: "foi buscado e está indo para o petshop" é notícia
  // que o tutor quer ver mesmo sem ninguém mais a caminho da casa dele.
  const concluidasHoje = chegadas.filter(
    (c) => c.status === "DONE" || c.status === "PICKED_UP",
  );

  if (!ativa) {
    return (
      <Card>
        {concluidasHoje.length > 0 ? (
          <div className="space-y-2">
            {concluidasHoje.map((c) => (
              <p key={c.id} className="flex items-center gap-2 text-sm text-graphite">
                <PackageCheck className="h-4 w-4 text-success" />
                {c.kind === "DROPOFF"
                  ? `${c.petName} já foi entregue em casa.`
                  : c.status === "PICKED_UP"
                    ? `${c.petName} foi buscado e está a caminho do petshop.`
                    : `${c.petName} chegou ao petshop.`}
              </p>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Ninguém a caminho agora"
            description="Quando o entregador do petshop sair para buscar ou devolver seu pet, você vê o trajeto dele aqui."
          />
        )}
      </Card>
    );
  }

  const distancia =
    posicao && ativa.destino
      ? distanciaEmMetros(posicao.lat, posicao.lng, ativa.destino.lat, ativa.destino.lng)
      : null;

  return (
    <Card className="space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-orange">
          {ativa.kind === "PICKUP" ? "A caminho para buscar" : "Voltando para casa"}
        </p>
        <h2 className="font-heading text-lg font-semibold text-graphite">
          {ativa.kind === "PICKUP"
            ? `Estamos indo buscar ${ativa.petName}`
            : `${ativa.petName} está voltando para casa`}
        </h2>
        {distancia !== null && (
          <p className="text-sm text-gray-neutral">
            {distancia < 300
              ? "Chegando agora — já está pertinho."
              : `A cerca de ${(distancia / 1000).toFixed(1)} km daí, em linha reta.`}
          </p>
        )}
      </div>

      {/* Sem nenhum ponto para mostrar, o Leaflet cai no enquadramento do
          país inteiro — um mapa do Brasil não diz nada a quem quer saber se o
          entregador está perto. Nesse caso a frase sozinha informa mais. */}
      {(posicao || ativa.destino) && (
        <MapaChegada
          entregador={posicao}
          destino={ativa.destino}
          className="w-full overflow-hidden rounded-xl"
        />
      )}

      {!posicao && (
        <p className="text-sm text-gray-neutral">
          O entregador já saiu. A localização ao vivo aparece assim que o
          aparelho dele enviar o primeiro sinal.
        </p>
      )}
    </Card>
  );
}
