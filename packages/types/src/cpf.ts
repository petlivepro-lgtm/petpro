/**
 * CPF brasileiro. Espelha normalize_tutor_cpf do banco
 * (0026_finance_management.sql), que grava só os dígitos — se mudar aqui,
 * mude lá.
 *
 * Módulo sem "use client" de propósito: é usado tanto pelo CpfInput quanto
 * pelas telas server-side que exibem o CPF gravado.
 */

/** Só os dígitos, limitado aos 11 do CPF. */
export function cpfDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(0, 11);
}

/** CPF completo tem 11 dígitos — é o que o check tutor_cpf_digits exige. */
export function isValidCpfBR(digits: string): boolean {
  return digits.length === 11;
}

/** Máscara 123.456.789-01, tolerante a valor parcial. */
export function formatCpfBR(value: string | null | undefined): string {
  const d = cpfDigits(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
