import { Home, CalendarPlus, Video, ShoppingBag, ClipboardList, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { href: "/", label: "Início", icon: Home },
  { href: "/agendar", label: "Agendar", icon: CalendarPlus },
  { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { href: "/ao-vivo", label: "Ao vivo", icon: Video },
  { href: "/produtos", label: "Produtos", icon: ShoppingBag },
];
