import {
  LayoutDashboard,
  CalendarClock,
  CalendarDays,
  Crown,
  Users,
  UsersRound,
  Package,
  PawPrint,
  Scissors,
  Truck,
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
 * Menu do painel. Os papéis de campo veem só o próprio trabalho: o colaborador
 * (0030) a própria agenda e os pets que atende, o entregador (0061) a rota de
 * leva-e-traz do dia — o resto é gestão do petshop.
 *
 * Esconder aqui é conveniência, não segurança: a RLS é quem barra os dados, e
 * o middleware redireciona quem digitar a rota na barra de endereços.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Visão geral",
    icon: LayoutDashboard,
    // A raiz serve três painéis diferentes: gestão para os demais papéis,
    // "meu dia" para o colaborador e "minha rota" para o entregador
    // (ver (app)/page.tsx).
    roles: [...MANAGEMENT_ROLES, "COLLABORATOR", "DELIVERY"],
  },
  { href: "/solicitacoes", label: "Solicitações", icon: CalendarClock, roles: MANAGEMENT_ROLES },
  {
    href: "/atendimentos",
    label: "Agenda",
    icon: CalendarDays,
    roles: [...MANAGEMENT_ROLES, "COLLABORATOR"],
  },
  { href: "/pets", label: "Pets", icon: PawPrint, roles: ["COLLABORATOR"] },
  { href: "/rota", label: "Minha rota", icon: Truck, roles: ["DELIVERY"] },
  { href: "/tutores", label: "Tutores & Pets", icon: Users, roles: MANAGEMENT_ROLES },
  { href: "/colaboradores", label: "Colaboradores", icon: UsersRound, roles: MANAGEMENT_ROLES },
  { href: "/servicos", label: "Serviços", icon: Scissors, roles: MANAGEMENT_ROLES },
  { href: "/clubinho", label: "Clubinho", icon: Crown, roles: MANAGEMENT_ROLES },
  { href: "/produtos", label: "Produtos", icon: Package, roles: MANAGEMENT_ROLES },
  { href: "/financeiro", label: "Gestão", icon: Wallet, roles: MANAGEMENT_ROLES },
];

export function navItemsForRole(role: StaffRole | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
