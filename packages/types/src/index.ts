export * from "./enums";
export * from "./dto";
export type { Database, Tables, TablesInsert, Json } from "./database.types";

/** Formata centavos (integer) em moeda BRL. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
