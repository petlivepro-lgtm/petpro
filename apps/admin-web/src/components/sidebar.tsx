"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AtSign,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  ShieldCheck,
  Store,
  Users,
  Video,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@mylivepet/ui";
import { hasRole, ROLE_LABEL, type AdminRole } from "@/lib/roles";
import { logoutAction } from "@/app/actions";
import { PushToggle } from "./push-toggle";

type Item = { href: string; label: string; icon: LucideIcon; minRole: AdminRole; badge?: "support" | "security" };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "Monitorar",
    items: [
      { href: "/", label: "Visão geral", icon: LayoutDashboard, minRole: "suporte" },
      { href: "/petshops", label: "Petshops", icon: Store, minRole: "suporte" },
      { href: "/tutores", label: "Tutores", icon: Users, minRole: "suporte" },
      { href: "/financeiro", label: "Financeiro", icon: Wallet, minRole: "admin" },
      { href: "/suporte", label: "Suporte", icon: MessageSquare, minRole: "suporte", badge: "support" },
      { href: "/atividade", label: "Atividade", icon: Activity, minRole: "suporte" },
      { href: "/cameras", label: "Câmeras", icon: Video, minRole: "suporte" },
      { href: "/identidade", label: "Busca de identidade", icon: AtSign, minRole: "suporte" },
    ],
  },
  {
    title: "Governança",
    items: [
      { href: "/admins", label: "Administradores", icon: ShieldCheck, minRole: "admin" },
      { href: "/auditoria", label: "Auditoria", icon: FileText, minRole: "admin" },
      { href: "/seguranca", label: "Segurança", icon: Lock, minRole: "admin", badge: "security" },
    ],
  },
];

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "A";
}

function NavContent({
  role,
  name,
  supportCount,
  securityCount,
}: {
  role: AdminRole;
  name: string;
  supportCount: number;
  securityCount: number;
}) {
  const pathname = usePathname();
  return (
    <>
      <div className="flex flex-col gap-3.5 px-2.5">
        <img src="/brand/logopet-white.svg" alt="Pet Live Pro" className="h-auto w-32" />
        <span className="self-start rounded-md border border-white/15 bg-white/[0.08] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-surface-muted">
          Administração
        </span>
      </div>
      {GROUPS.map((group) => {
        const items = group.items.filter((item) => hasRole(role, item.minRole));
        if (!items.length) return null;
        return (
          <div key={group.title} className="flex flex-col gap-1">
            <span className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/50">
              {group.title}
            </span>
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm transition-colors",
                    active
                      ? "bg-petrol font-semibold text-white"
                      : "font-medium text-white/75 hover:bg-white/[0.06] hover:text-white",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                  {item.label}
                  {item.badge === "support" && supportCount > 0 && (
                    <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-orange px-1.5 text-xs font-bold text-white">
                      <span className="sr-only">novos: </span>
                      {supportCount}
                    </span>
                  )}
                  {item.badge === "security" && securityCount > 0 && (
                    <span className="ml-auto grid h-[22px] min-w-[22px] place-items-center rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                      <span className="sr-only">uploads suspeitos para analisar: </span>
                      {securityCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
      <div className="mt-auto flex flex-col gap-2.5 border-t border-white/10 px-2.5 pt-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-orange text-[13px] font-bold text-white"
          >
            {initials(name)}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white">{name}</span>
            <span className="text-xs text-white/60">{ROLE_LABEL[role]}</span>
          </div>
        </div>
        <PushToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex min-h-10 w-full items-center gap-2.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden /> Sair
          </button>
        </form>
      </div>
    </>
  );
}

export function Sidebar(props: { role: AdminRole; name: string; supportCount: number; securityCount: number }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <aside
        aria-label="Administração"
        className="scrollbar-dark fixed inset-y-0 left-0 hidden w-[248px] flex-col gap-7 overflow-y-auto bg-graphite px-4 pb-5 pt-7 text-white lg:flex"
      >
        <NavContent {...props} />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-graphite px-4 py-3 lg:hidden">
        <img src="/brand/logopet-white.svg" alt="Pet Live Pro" className="h-9 w-auto" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="grid h-11 w-11 place-items-center rounded-xl text-white hover:bg-white/10"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-graphite/60" onClick={() => setOpen(false)} aria-hidden />
          <nav
            aria-label="Administração"
            className="scrollbar-dark absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col gap-7 overflow-y-auto bg-graphite px-4 pb-5 pt-5 text-white"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="grid h-11 w-11 place-items-center self-end rounded-xl text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <NavContent {...props} />
          </nav>
        </div>
      )}
    </>
  );
}
