"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@mylivepet/ui";
import { openCommandPalette } from "@/components/command-palette";

/**
 * A cara da busca: um botão que se parece com um campo.
 *
 * Não é um input de verdade de propósito — quem digita aqui está digitando na
 * paleta, e ter dois campos com o mesmo texto (um na página, outro no diálogo)
 * é o tipo de coisa que perde a primeira letra de quem escreve rápido.
 */
export function SearchTrigger({
  variant = "bar",
}: {
  variant?: "bar" | "sidebar";
}) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/mac/i.test(navigator.userAgent)), []);
  const shortcut = mac ? "⌘K" : "Ctrl K";

  const sidebar = variant === "sidebar";

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Buscar no painel"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-graphite/15 bg-surface text-left",
        "text-gray-neutral transition-colors hover:border-orange/40 hover:text-graphite",
        sidebar ? "px-3 py-2 text-sm" : "px-4 py-3",
      )}
    >
      <Search className={cn("shrink-0", sidebar ? "h-4 w-4" : "h-[18px] w-[18px]")} />
      <span className="min-w-0 flex-1 truncate">
        {sidebar ? "Buscar" : "Buscar pets, tutores, atendimentos, páginas..."}
      </span>
      <kbd
        className={cn(
          "shrink-0 rounded border border-graphite/15 bg-surface-muted px-1.5 py-0.5",
          "font-sans text-[10px] text-gray-neutral",
        )}
      >
        {shortcut}
      </kbd>
    </button>
  );
}
