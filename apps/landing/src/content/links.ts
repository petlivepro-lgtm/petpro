// Endereços dos apps em produção (ver PRODUCAO.md).
export const PRO_URL = process.env.NEXT_PUBLIC_PRO_URL ?? "https://app.petlivepro.com.br";
export const TUTOR_URL = process.env.NEXT_PUBLIC_TUTOR_URL ?? "https://tutor.petlivepro.com.br";

export const SIGNUP_URL = `${PRO_URL}/cadastrar`;
export const LOGIN_URL = `${PRO_URL}/login`;
