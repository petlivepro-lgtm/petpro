// Regras de senha do painel e do app do tutor: cadastro do petshop, primeiro
// acesso do colaborador e do tutor, "criar senha" e redefinição. Módulo puro,
// no mesmo molde do admin-web (src/lib/password-policy.ts, que é mais rígido):
// a tela usa para mostrar o que falta enquanto a pessoa digita (NewPasswordFields
// de @mylivepet/ui), e o servidor usa as MESMAS regras para recusar — a
// checagem da tela é conforto, a do servidor é a que vale.

export const PETSHOP_PASSWORD_MIN = 8;
export const PETSHOP_PASSWORD_MAX = 72;

export type PasswordRule = { id: string; label: string; test: (password: string, email?: string) => boolean };

export const PETSHOP_PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `Pelo menos ${PETSHOP_PASSWORD_MIN} caracteres`, test: (p) => p.length >= PETSHOP_PASSWORD_MIN },
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

/** Regras que a senha ainda não cumpre (vazio = pode cadastrar). */
export function failedPetshopPasswordRules(password: string, email?: string): PasswordRule[] {
  if (password.length > PETSHOP_PASSWORD_MAX) {
    return [{ id: "max", label: `No máximo ${PETSHOP_PASSWORD_MAX} caracteres`, test: () => false }];
  }
  return PETSHOP_PASSWORD_RULES.filter((rule) => !rule.test(password, email));
}

// Nomes gerais: a mesma regra vale para petshop, colaborador e tutor.
export const PASSWORD_MIN = PETSHOP_PASSWORD_MIN;
export const PASSWORD_MAX = PETSHOP_PASSWORD_MAX;
export const PASSWORD_RULES = PETSHOP_PASSWORD_RULES;
export const failedPasswordRules = failedPetshopPasswordRules;

/** Mensagem do servidor quando a senha não passa: a primeira regra que falta. */
export function passwordPolicyError(password: string, email?: string): string | null {
  const [first] = failedPetshopPasswordRules(password, email);
  return first ? `A senha não cumpre a regra: ${first.label}.` : null;
}
