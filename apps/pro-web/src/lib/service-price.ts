import {
  formatBRL,
  hasSizePrices,
  petSizePriceRange,
  type PricedBySize,
} from "@mylivepet/types";

/**
 * Como o catálogo mostra o preço de um serviço ou adicional (0058).
 *
 * Sem preço por porte cadastrado é um valor só, como sempre foi. Com preço por
 * porte, um valor único mentiria — o catálogo passa a mostrar a faixa cobrada.
 */
export function formatCatalogPrice(row: PricedBySize): string {
  if (!hasSizePrices(row)) return formatBRL(row.price_cents);
  const { min, max } = petSizePriceRange(row);
  return min === max ? formatBRL(min) : `${formatBRL(min)} – ${formatBRL(max)}`;
}
