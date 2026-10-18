// Planos exibidos na seção de preços.
// TODO(preço): nomes, valores e recursos ainda não definidos pelo dono do produto.
// Enquanto `draft` for true, a página mostra "nome provisório"; com `priceCents`
// null, "Valor a confirmar"; com `includes` vazio, linhas provisórias.
// Não publicar com placeholders.
export interface Plan {
  name: string;
  draft: boolean;
  description: string | null;
  priceCents: number | null;
  includes: string[];
  /** quantas linhas provisórias mostrar enquanto `includes` está vazio */
  placeholderRows: number;
  highlight: boolean;
}

export const plans: Plan[] = [
  {
    name: "Plano 1",
    draft: true,
    description: null,
    priceCents: null,
    includes: [],
    placeholderRows: 5,
    highlight: false,
  },
  {
    name: "Plano 2",
    draft: true,
    description: null,
    priceCents: null,
    includes: [],
    placeholderRows: 7,
    highlight: true,
  },
];

export function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
