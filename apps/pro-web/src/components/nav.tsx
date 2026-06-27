"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarClock, ClipboardList, Users, Package, Scissors } from "lucide-react";
import { cn } from "@mylivepet/ui";

const items = [
  { href: "/", label: "Visão geral", icon: LayoutDashboard },
  { href: "/solicitacoes", label: "Solicitações", icon: CalendarClock },
  { href: "/atendimentos", label: "Atendimentos", icon: ClipboardList },
  { href: "/tutores", label: "Tutores & Pets", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/produtos", label: "Produtos", icon: Package },
];

export function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-orange/10 text-orange"
                : "text-graphite/70 hover:bg-surface-muted",
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
