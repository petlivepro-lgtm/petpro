// Regras da senha administrativa. Módulo puro: a tela usa para mostrar o que
// falta enquanto a pessoa digita, e o servidor usa as MESMAS regras para
// recusar — a checagem da tela é conforto, a do servidor é a que vale.

export const ADMIN_PASSWORD_MIN = 12;
export const ADMIN_PASSWORD_MAX = 128;

export type PasswordRule = { id: string; label: string; test: (password: string, email?: string) => boolean };

export const ADMIN_PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `Pelo menos ${ADMIN_PASSWORD_MIN} caracteres`, test: (p) => p.length >= ADMIN_PASSWORD_MIN },
  { id: "upper", label: "Uma letra maiúscula", test: (p) => /\p{Lu}/u.test(p) },
  { id: "lower", label: "Uma letra minúscula", test: (p) => /\p{Ll}/u.test(p) },
  { id: "digit", label: "Um número", test: (p) => /\d/.test(p) },
  { id: "special", label: "Um caractere especial (! @ # $ % & * …)", test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
  {
    id: "email",
    label: "Não conter o seu e-mail",
    test: (p, email) => {
      const local = email?.split("@")[0]?.toLowerCase();
      return !local || local.length < 3 || !p.toLowerCase().includes(local);
    },
  },
];

/** Regras que a senha ainda não cumpre (vazio = pode salvar). */
export function failedPasswordRules(password: string, email?: string): PasswordRule[] {
  if (password.length > ADMIN_PASSWORD_MAX) {
    return [{ id: "max", label: `No máximo ${ADMIN_PASSWORD_MAX} caracteres`, test: () => false }];
  }
  return ADMIN_PASSWORD_RULES.filter((rule) => !rule.test(password, email));
}
