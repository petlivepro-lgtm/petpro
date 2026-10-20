"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { cn } from "@mylivepet/ui";
import { navItems } from "./nav-items";

/**
 * O que fica direto na barra do celular. Sete itens em ~375px davam 50px para
 * cada um e "A caminho" quebrava em duas linhas; o resto vai para "Mais".
 */
const PRIMARY = new Set(["/", "/agendar", "/atendimentos", "/ao-vivo"]);

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const primary = navItems.filter((item) => PRIMARY.has(item.href));
  const more = navItems.filter((item) => !PRIMARY.has(item.href));
  const moreActive = more.some((item) => isActive(pathname, item.href));

  // Navegou (por este menu ou por qualquer link): fecha.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const itemClass = (active: boolean) =>
    cn(
      "flex flex-1 flex-col items-center gap-0.5 whitespace-nowrap py-2.5 text-xs font-medium transition-colors",
      active ? "text-orange" : "text-gray-neutral",
    );

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-graphite/20 lg:hidden"
        />
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-graphite/10 bg-surface lg:hidden">
        {open && (
          <div
            id="menu-mais"
            className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-2xl border border-graphite/10 bg-surface shadow-card-hover"
          >
            <ul className="mx-auto max-w-md divide-y divide-graphite/5">
              {more.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-surface-muted",
                        active ? "text-orange" : "text-graphite",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mx-auto flex max-w-md">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mais"
            className={itemClass(moreActive || open)}
          >
            <Ellipsis className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>
    </>
  );
}
