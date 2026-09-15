import type { AddressInput } from "./dto";
import type { AddressParts } from "./address";

/**
 * Ponte entre o formulário e as colunas de endereço (migração 0059).
 *
 * Mora no pacote compartilhado, e não num app, porque os dois lados gravam o
 * mesmo endereço: o petshop no cadastro do tutor e do pet, e o próprio tutor
 * no perfil dele (tutor-pwa). Duas cópias dessas regras divergiriam no dia em
 * que uma coluna fosse acrescentada.
 *
 * As duas funções andam juntas: `addressFromForm` tira os sete campos do
 * FormData para o zod validar, `addressColumns` converte o resultado em
 * colunas. O `?? null` importa: campo apagado precisa virar null no banco, e
 * bloco "mesmo endereço do tutor" não manda campo nenhum — ausência e vazio
 * são a mesma coisa aqui, e as duas gravam null.
 */

function str(value: FormDataEntryValue | null): string | undefined {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? undefined : text;
}

/** `prefix` é "pet_" quando o pet vem no mesmo formulário do tutor. */
export function addressFromForm(formData: FormData, prefix = "") {
  return {
    cep: str(formData.get(`${prefix}cep`)),
    street: str(formData.get(`${prefix}street`)),
    street_number: str(formData.get(`${prefix}street_number`)),
    complement: str(formData.get(`${prefix}complement`)),
    district: str(formData.get(`${prefix}district`)),
    city: str(formData.get(`${prefix}city`)),
    state: str(formData.get(`${prefix}state`)),
  };
}

export function addressColumns(parsed: AddressInput) {
  return {
    cep: parsed.cep ?? null,
    street: parsed.street ?? null,
    street_number: parsed.street_number ?? null,
    complement: parsed.complement ?? null,
    district: parsed.district ?? null,
    city: parsed.city ?? null,
    state: parsed.state ?? null,
  };
}

/**
 * Só as sete colunas de endereço de uma linha de tutor/pet — para repassar a
 * um diálogo sem arrastar o resto do cadastro junto.
 */
export function pickAddress(row: AddressParts): AddressParts {
  return {
    cep: row.cep ?? null,
    street: row.street ?? null,
    street_number: row.street_number ?? null,
    complement: row.complement ?? null,
    district: row.district ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
  };
}
