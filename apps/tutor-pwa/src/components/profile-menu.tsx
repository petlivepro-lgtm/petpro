"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Settings } from "lucide-react";
import { Avatar, cn } from "@mylivepet/ui";
import { signOut } from "@/app/(app)/actions";

/**
 * O menu da conta no topo do celular. Substituiu a engrenagem solta: ali só
 * dava para chegar em Configurações, e sair da conta não existia em lugar
 * nenhum no mobile — o botão "Sair" morava só na barra lateral do desktop.
 *
 * Dropdown ancorado por posição absoluta em vez de portal: o cabeçalho não fica
 * dentro de nada com overflow, então não há o que cortar o painel.
 */
export function ProfileMenu({ fullName }: { fullName: string }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Navegou (inclusive para Configurações): o menu não pode ficar aberto por cima.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium text-graphite transition-colors hover:bg-surface-muted";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Minha conta"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
          open ? "bg-surface-muted" : "hover:bg-surface-muted",
        )}
      >
        <Avatar name={fullName} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Minha conta"
          className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-2xl border border-graphite/10 bg-surface py-1 shadow-card-hover"
        >
          <p className="truncate px-3 pb-1.5 pt-1 text-xs text-gray-neutral">
            {fullName}
          </p>
          {/* Fecha à mão também: clicar já estando em Configurações não muda o
              pathname, e o menu ficaria aberto por cima da página. */}
          <Link
            href="/configuracoes"
            role="menuitem"
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-gray-neutral" /> Configurações
          </Link>
          <form action={signOut}>
            <button type="submit" role="menuitem" className={itemClass}>
              <LogOut className="h-4 w-4 text-gray-neutral" /> Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
