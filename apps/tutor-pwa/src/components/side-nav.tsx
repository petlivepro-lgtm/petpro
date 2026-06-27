"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn, Button } from "@mylivepet/ui";
import { navItems } from "./nav-items";
import { signOut } from "@/app/(app)/actions";

export function SideNav({ tenantName }: { tenantName: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 hidden w-64 flex-col justify-between border-r border-graphite/10 bg-surface p-4 lg:flex">
      <div>
        <div className="mb-8 px-2 pt-2">
          <img src="/brand/logopet.svg" alt="MyLivePet" className="h-20 w-auto" />
          <p className="mt-0.5 text-xs text-gray-neutral">{tenantName}</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-orange/10 text-orange" : "text-graphite/70 hover:bg-surface-muted",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <form action={signOut}>
        <Button variant="ghost" className="w-full justify-start" type="submit">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      </form>
    </aside>
  );
}
