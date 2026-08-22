"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Qual gatilho responde por cada `?novo=<slug>` na página atual.
 *
 * As páginas montam o mesmo formulário mais de uma vez — o botão do cabeçalho
 * e o do estado vazio são duas instâncias do mesmo diálogo. Sem um dono, as
 * duas abririam uma sobre a outra. O primeiro a montar fica com o slug.
 */
const owners = new Map<string, symbol>();

/**
 * Abre um formulário quando a URL pede: `?novo=<slug>`.
 *
 * É assim que as ações da paleta de comandos ("Novo tutor") chegam ao diálogo
 * certo — a paleta navega para a página que sabe salvar e deixa o formulário
 * se abrir lá, em vez de montar cópias dos diálogos de cadastro fora do lugar
 * deles.
 *
 * O parâmetro é apagado logo depois: recarregar a página, ou voltar para ela
 * pelo histórico, não deve reabrir um formulário que a pessoa já fechou.
 *
 * `enabled` desliga o gatilho nas instâncias de edição — um `ProductDialog`
 * com produto é "editar aquele item", não "novo produto".
 */
export function useOpenFromUrl(
  slug: string,
  onOpen: () => void,
  enabled = true,
) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef(false);
  const open = useRef(onOpen);
  open.current = onOpen;

  const idRef = useRef<symbol | null>(null);
  idRef.current ??= Symbol(slug);
  const id = idRef.current;

  useEffect(() => {
    return () => {
      if (owners.get(slug) === id) owners.delete(slug);
    };
  }, [slug, id]);

  useEffect(() => {
    if (!enabled) return;
    if (!owners.has(slug)) owners.set(slug, id);
    if (owners.get(slug) !== id) return;

    if (params.get("novo") !== slug) {
      // Saiu da URL: uma nova ação da paleta pode abrir o formulário de novo.
      fired.current = false;
      return;
    }
    if (fired.current) return;
    fired.current = true;
    open.current();

    const next = new URLSearchParams(params.toString());
    next.delete("novo");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [params, pathname, router, slug, id, enabled]);
}
