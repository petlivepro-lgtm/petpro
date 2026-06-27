"use client";

import { useEffect, useState } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { Avatar, Button } from "@mylivepet/ui";
import { Nav } from "./nav";
import { signOut } from "@/app/(app)/actions";

export function MobileNav({
  tenantName,
  email,
  role,
}: {
  tenantName: string;
  email: string;
  role?: string;
}) {
  const [open, setOpen] = useState(false);

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
      {/* Barra superior (apenas mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-graphite/10 bg-graphite px-4 py-3 text-white md:hidden">
        <div>
          <img src="/brand/logopet.svg" alt="Pet Live Pro" className="h-9 w-auto" />
          <p className="text-[11px] text-gray-soft/60">{tenantName}</p>
        </div>
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Overlay + drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-graphite/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col justify-between bg-graphite p-4 text-white shadow-xl">
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <img src="/brand/logopet.svg" alt="Pet Live Pro" className="h-9 w-auto" />
                  <p className="text-xs text-gray-soft/60">{tenantName}</p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Nav onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-white/10 pt-3">
              <div className="mb-2 flex items-center gap-3 px-2">
                <Avatar name={email} size="sm" className="bg-white/10 text-white" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{email}</p>
                  {role && <p className="text-xs capitalize text-gray-soft/60">{role.toLowerCase()}</p>}
                </div>
              </div>
              <form action={signOut}>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-gray-soft/80 hover:bg-white/5 hover:text-white"
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
