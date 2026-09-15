/**
 * Endereço de tutor e de pet (migração 0059).
 *
 * Módulo sem "use client" de propósito, como o de CPF: o CepInput usa a
 * máscara no navegador e as telas de servidor usam a mesma função para exibir
 * o endereço gravado.
 *
 * O CEP é guardado só com dígitos (o trigger normalize_address_fields garante
 * isso no banco) — a máscara é da tela.
 */

export type AddressParts = {
  cep?: string | null;
  street?: string | null;
  street_number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

/** Os campos que compõem um endereço, na ordem em que aparecem no formulário. */
export const ADDRESS_FIELDS = [
  "cep",
  "street",
  "street_number",
  "complement",
  "district",
  "city",
  "state",
] as const satisfies readonly (keyof AddressParts)[];

/** Só os dígitos, limitado aos 8 do CEP. */
export function cepDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 8);
}

/** CEP completo tem 8 dígitos — é o que o check tutor_cep_digits exige. */
export function isValidCep(digits: string): boolean {
  return digits.length === 8;
}

/** Máscara 22041-001, tolerante a valor parcial. */
export function formatCep(value: string | null | undefined): string {
  const d = cepDigits(value);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Tem endereço próprio? É esta pergunta que decide se o pet mora com o tutor:
 * as sete colunas nulas significam herança (ver 0059), e não há flag booleana
 * que possa divergir do conteúdo.
 */
export function hasAddress(parts: AddressParts | null | undefined): boolean {
  if (!parts) return false;
  return ADDRESS_FIELDS.some((field) => {
    const value = parts[field];
    return typeof value === "string" && value.trim() !== "";
  });
}

/**
 * Endereço em uma linha: "Av. Atlântica, 1702, apto 501 — Copacabana, Rio de
 * Janeiro/RJ — 22041-001". Devolve null quando não há nada preenchido, para a
 * tela poder omitir a linha inteira.
 */
export function formatAddressLine(
  parts: AddressParts | null | undefined,
): string | null {
  if (!hasAddress(parts)) return null;
  const clean = (value: string | null | undefined) => value?.trim() || null;

  const logradouro = [clean(parts!.street), clean(parts!.street_number), clean(parts!.complement)]
    .filter(Boolean)
    .join(", ");

  const cidadeUf = [clean(parts!.city), clean(parts!.state)].filter(Boolean).join("/");
  const localidade = [clean(parts!.district), cidadeUf || null].filter(Boolean).join(", ");

  const cep = clean(parts!.cep);
  return [logradouro || null, localidade || null, cep ? formatCep(cep) : null]
    .filter(Boolean)
    .join(" — ");
}

/** As 27 unidades federativas, para o seletor de UF do formulário. */
export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type Uf = (typeof UF_OPTIONS)[number];
