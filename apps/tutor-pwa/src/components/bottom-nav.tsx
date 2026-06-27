"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@mylivepet/ui";
import { navItems } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-graphite/10 bg-surface lg:hidden">
      <div className="mx-auto flex max-w-md">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium",
                active ? "text-orange" : "text-gray-neutral",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
