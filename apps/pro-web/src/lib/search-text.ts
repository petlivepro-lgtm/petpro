/**
 * Comparação de texto das buscas do painel.
 *
 * Fica num módulo neutro (sem "use client") porque as listas de servidor
 * filtram com as mesmas funções que os catálogos filtram no navegador — e
 * importar de um módulo cliente dentro de um Server Component estoura em
 * tempo de execução.
 */

export function normalizeCatalogSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function matchesCatalogSearch(values: unknown[], query: string) {
  const terms = normalizeCatalogSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeCatalogSearch(values.join(" "));
  return terms.every((term) => searchableText.includes(term));
}
