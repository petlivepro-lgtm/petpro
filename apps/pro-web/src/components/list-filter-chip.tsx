import Link from "next/link";
import { Search, X } from "lucide-react";

/**
 * Aviso de que a lista chegou filtrada pela busca global (`?q=`).
 *
 * Sem ele a página parece ter perdido registros: quem clicou num tutor na
 * paleta de comandos cai numa lista de um item só e precisa entender por quê,
 * e ter como voltar à lista inteira num clique.
 */
export function ListFilterChip({
  query,
  clearHref,
  count,
}: {
  query: string;
  /** Para onde o "Limpar" leva — a mesma lista, sem o filtro. */
  clearHref: string;
  count: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-graphite/10 bg-surface px-3 py-2 text-sm text-gray-neutral">
      <Search className="h-4 w-4 shrink-0" />
      <span>
        Filtrando por{" "}
        <strong className="font-medium text-graphite">“{query}”</strong> —{" "}
        {count} {count === 1 ? "resultado" : "resultados"}.
      </span>
      <Link
        href={clearHref}
        className="ml-auto inline-flex items-center gap-1 font-medium hover:text-graphite"
      >
        <X className="h-3.5 w-3.5" /> Limpar
      </Link>
    </div>
  );
}
