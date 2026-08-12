export * from "./enums";
export * from "./dto";
export * from "./behavior";
export * from "./finance";
export * from "./phone";
export * from "./cpf";
export type { Database, Tables, TablesInsert, Json } from "./database.types";

/** Formata centavos (integer) em moeda BRL. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Peso da variação como "500 g" / "1,5 kg" (sem zeros à direita). */
export function formatWeight(
  value: number | string | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (value === null || value === undefined || !unit) return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} ${unit}`;
}

/**
 * Rótulo da variação ("Preto · M · 1 kg"). Espelha product_variant_label do
 * banco (0020_product_variants.sql) — o snapshot gravado na reserva vem de lá,
 * esta versão serve às telas que montam o rótulo a partir das colunas.
 */
export function formatVariantLabel(v: {
  color_name?: string | null;
  size?: string | null;
  weight_value?: number | string | null;
  weight_unit?: string | null;
}): string | null {
  const parts = [
    v.color_name,
    v.size,
    formatWeight(v.weight_value, v.weight_unit),
  ].filter((p): p is string => !!p && p.trim() !== "");
  return parts.length > 0 ? parts.join(" · ") : null;
}
