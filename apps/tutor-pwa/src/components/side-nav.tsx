"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { cn, Button } from "@mylivepet/ui";
import { navItems } from "./nav-items";
import { TenantBrand } from "./tenant-brand";
import { signOut } from "@/app/(app)/actions";

export function SideNav({
  tenantName,
  tenantLogoUrl,
  bell,
}: {
  tenantName: string;
  tenantLogoUrl: string | null;
  /** Sino de notificações, montado no layout (server component). */
  bell?: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 hidden w-64 flex-col justify-between border-r border-graphite/10 bg-surface p-4 lg:flex">
      <div>
        <div className="mb-8 px-2 pt-2">
          <img
            src="/brand/logopet.svg"
            alt="MyLivePet"
            className="h-20 w-auto"
          />
          <div className="mt-4 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <TenantBrand name={tenantName} logoUrl={tenantLogoUrl} />
            </div>
            {bell && <div className="-mr-1 shrink-0">{bell}</div>}
          </div>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-orange/10 text-orange"
                    : "text-graphite/70 hover:bg-surface-muted",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/configuracoes")
              ? "bg-orange/10 text-orange"
              : "text-graphite/70 hover:bg-surface-muted",
          )}
        >
          <Settings className="h-[18px] w-[18px]" /> Configurações
        </Link>
        <form action={signOut}>
          <Button
            variant="ghost"
            className="w-full justify-start"
            type="submit"
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </form>
      </div>
    </aside>
  );
}
