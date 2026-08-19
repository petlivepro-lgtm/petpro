"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, LogOut, Settings } from "lucide-react";
import { Avatar, Button } from "@mylivepet/ui";
import { STAFF_ROLE_LABEL, type StaffRole } from "@mylivepet/types";
import { Nav } from "./nav";
import { signOut } from "@/app/(app)/actions";

export function MobileNav({
  tenantName,
  logoUrl,
  userName,
  role,
  bell,
}: {
  tenantName: string;
  logoUrl?: string | null;
  userName: string;
  role?: StaffRole;
  /** Sino de notificações, montado no layout (server) e só exibido à gestão. */
  bell?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isCollaborator = role === "COLLABORATOR";

  // trava o scroll do body e fecha com Esc enquanto o drawer está aberto
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Barra superior (apenas mobile): menu à esquerda, sino à direita. */}
      <header className="sticky top-0 z-30 flex items-center border-b border-graphite/10 bg-surface px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-graphite hover:bg-surface-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        {bell && <div className="ml-auto">{bell}</div>}
      </header>

      {/* Overlay + drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-graphite/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col justify-between bg-surface p-4 shadow-xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div className="min-w-0">
                  <img
                    src="/brand/logopet.svg"
                    alt="Pet Live Pro"
                    className="h-14 max-w-[180px] object-contain"
                  />
                  <div className="flex items-center gap-1.5">
                    {logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
                    )}
                    <p className="truncate text-xs text-gray-neutral">{tenantName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-graphite hover:bg-surface-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Nav role={role} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-graphite/10 pt-3">
              <div className="mb-2 flex items-center gap-3 px-2">
                <Avatar name={userName} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-graphite">{userName}</p>
                  {role && (
                    <p className="text-xs text-gray-neutral">{STAFF_ROLE_LABEL[role]}</p>
                  )}
                </div>
              </div>
              {!isCollaborator && (
                <Link
                  href="/configuracoes"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-graphite/70 transition-colors hover:bg-surface-muted"
                >
                  <Settings className="h-4 w-4" /> Configurações
                </Link>
              )}
              <form action={signOut}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-graphite/70 hover:bg-surface-muted"
                  type="submit"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
