import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Users,
  UsersRound,
  Package,
  PawPrint,
  Scissors,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { MANAGEMENT_ROLES, type StaffRole } from "@mylivepet/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Papéis que enxergam o item. */
  roles: readonly StaffRole[];
};

/**
 * Menu do painel. O colaborador (0030) só acompanha a própria agenda e os pets
 * que atende — o resto é gestão do petshop.
 *
 * Esconder aqui é conveniência, não segurança: a RLS é quem barra os dados, e
 * o middleware redireciona quem digitar a rota na barra de endereços.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Visão geral",
    icon: LayoutDashboard,
    // A raiz serve dois painéis diferentes: gestão para os demais papéis,
    // "meu dia" para o colaborador (ver (app)/page.tsx).
    roles: [...MANAGEMENT_ROLES, "COLLABORATOR"],
  },
  { href: "/solicitacoes", label: "Solicitações", icon: CalendarClock, roles: MANAGEMENT_ROLES },
  {
    href: "/atendimentos",
    label: "Agenda",
    icon: CalendarDays,
    roles: [...MANAGEMENT_ROLES, "COLLABORATOR"],
  },
  { href: "/pets", label: "Pets", icon: PawPrint, roles: ["COLLABORATOR"] },
  { href: "/tutores", label: "Tutores & Pets", icon: Users, roles: MANAGEMENT_ROLES },
  { href: "/colaboradores", label: "Colaboradores", icon: UsersRound, roles: MANAGEMENT_ROLES },
  { href: "/servicos", label: "Serviços", icon: Scissors, roles: MANAGEMENT_ROLES },
  { href: "/produtos", label: "Produtos", icon: Package, roles: MANAGEMENT_ROLES },
  { href: "/financeiro", label: "Gestão", icon: Wallet, roles: MANAGEMENT_ROLES },
];

export function navItemsForRole(role: StaffRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
