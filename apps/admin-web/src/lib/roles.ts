// Hierarquia administrativa — a única definição de papéis do admin.
//
// Módulo puro (sem Supabase, sem server-only) porque as duas pontas precisam
// da mesma tabela: o servidor para autorizar em requireAdmin e a tela de
// Administradores para mostrar o que cada papel alcança. Se a matriz morasse
// só no servidor, a UI voltaria a adivinhar permissões.

export type AdminRole = "superadmin" | "admin" | "suporte";
export type AdminStatus = "invited" | "active" | "suspended";

export const ROLE_RANK: Record<AdminRole, number> = {
  suporte: 1,
  admin: 2,
  superadmin: 3,
};

export const ADMIN_ROLES: AdminRole[] = ["superadmin", "admin", "suporte"];

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  suporte: "Suporte",
};

export const STATUS_LABEL: Record<AdminStatus, string> = {
  invited: "Convite pendente",
  active: "Ativo",
  suspended: "Suspenso",
};

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "superadmin" || value === "admin" || value === "suporte";
}

/** Comparação por rank: `minimum: "admin"` barra suporte sem afrouxar nada acima. */
export function hasRole(role: AdminRole, minimum: AdminRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Papéis que `role` pode atribuir a outra pessoa: só os estritamente abaixo
 * do seu. Ninguém clona o próprio nível — superadmin novo só nasce pelo
 * script de bootstrap ou direto no banco.
 */
export function assignableRoles(role: AdminRole): AdminRole[] {
  return ADMIN_ROLES.filter((candidate) => ROLE_RANK[candidate] < ROLE_RANK[role]);
}

export type PermissionEntry = { action: string; minimumRole: AdminRole };

/** Documentação viva: a tela de Administradores renderiza esta lista. */
export const PERMISSION_MATRIX: PermissionEntry[] = [
  { action: "Ver painéis, petshops, tutores, atividade e câmeras", minimumRole: "suporte" },
  { action: "Escrever notas internas", minimumRole: "suporte" },
  { action: "Atender chamados de suporte", minimumRole: "suporte" },
  { action: "Revelar dado pessoal (com motivo)", minimumRole: "admin" },
  { action: "Reenviar link de senha a dono ou tutor", minimumRole: "admin" },
  { action: "Ver financeiro e assinaturas dos petshops", minimumRole: "admin" },
  { action: "Ver auditoria e segurança", minimumRole: "admin" },
  { action: "Convidar suporte", minimumRole: "admin" },
  { action: "Convidar admin, suspender, reativar e revogar sessões", minimumRole: "superadmin" },
];
