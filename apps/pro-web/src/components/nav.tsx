"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mylivepet/ui";
import type { StaffRole } from "@mylivepet/types";
import { navItemsForRole } from "./nav-items";

export function Nav({
  role,
  onNavigate,
}: {
  role?: StaffRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
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
