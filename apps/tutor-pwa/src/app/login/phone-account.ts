/**
 * Conta de auth de tutor que só tem telefone.
 *
 * O Supabase Auth deste projeto autentica por e-mail. Quando a ficha do
 * tutor não tem e-mail, a conta nasce com um endereço interno derivado do
 * telefone — o tutor nunca o vê nem o digita: ele entra pelo telefone e a
 * Server Action traduz. Se um dia ele cadastrar um e-mail de verdade no
 * perfil, a conta é atualizada (ver app/(app)/configuracoes/actions.ts).
 */
export const PHONE_EMAIL_DOMAIN = "telefone.mylivepet.app";

/** 11912345678 -> 5511912345678@telefone.mylivepet.app */
export function phoneAuthEmail(digits: string): string {
  return `55${digits}@${PHONE_EMAIL_DOMAIN}`;
}

/** Endereço interno gerado por phoneAuthEmail (não é e-mail real do tutor). */
export function isPhoneAuthEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}
