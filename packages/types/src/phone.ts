/**
 * Telefone brasileiro. Espelha normalize_phone_br do banco
 * (0028_tutor_phone_login.sql) — se mudar aqui, mude lá.
 *
 * Módulo sem "use client" de propósito: é usado tanto pelo PhoneInput
 * quanto pelas Server Actions do login por telefone.
 */

/** Só os dígitos, descartando o DDI 55 quando presente. */
export function phoneDigits(value: string | null | undefined): string {
  const d = (value ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    return d.slice(2);
  }
  return d;
}

/** DDD + fixo (10) ou DDD + celular (11). */
export function isValidPhoneBR(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

/** Máscara (11) 91234-5678 ou (11) 1234-5678, tolerante a valor parcial. */
export function formatPhoneBR(value: string | null | undefined): string {
  const d = phoneDigits(value).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
