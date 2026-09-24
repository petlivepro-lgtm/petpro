"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { fetchRota, type ParadaRow, type RotaDoDia } from "@/lib/rotas";

/**
 * As paradas do dia, vivas: parte do que o servidor renderizou e re-consulta a
 * cada mudança em delivery_stop. Serve o painel e a tela da rota — cada um com
 * seu canal, porque o Supabase não deixa dois assinantes no mesmo nome.
 */
export function useParadasDoDia(rota: RotaDoDia, dia: string, canal: string) {
  const fetcher = useCallback(async () => {
    const r = await fetchRota(createClient(), dia);
    return r?.paradas ?? [];
  }, [dia]);

  const paradas: ParadaRow[] = useRealtimeList(
    rota?.paradas ?? [],
    fetcher,
    [{ table: "delivery_stop" }],
    canal,
  );

  /**
   * O id da rota vem das PARADAS quando a prop não o tem.
   *
   * O entregador costuma abrir o painel antes de existir rota nenhuma, e é o
   * gatilho do banco (0065) que a cria quando o petshop aceita um pedido. A
   * parada chega aqui pelo realtime, mas a prop `rota` continua a que foi
   * renderizada no servidor — nula. Sem esta linha a tela seguiria dizendo
   * "nenhuma parada" com as paradas já na mão.
   */
  const rotaId = rota?.id ?? paradas[0]?.routeId ?? null;

  return { paradas, rotaId };
}
