"use client";

import { useEffect, useState } from "react";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Input, cn } from "@mylivepet/ui";

export type CatalogView = "cards" | "table";

export function useCatalogView(storageKey: string) {
  const [view, setView] = useState<CatalogView>("cards");

  useEffect(() => {
    try {
      const savedView = window.localStorage.getItem(storageKey);
      if (savedView === "cards" || savedView === "table") {
        setView(savedView);
      }
    } catch {
      // O catálogo continua funcional quando o navegador bloqueia o localStorage.
    }
  }, [storageKey]);

  function updateView(nextView: CatalogView) {
    setView(nextView);
    try {
      window.localStorage.setItem(storageKey, nextView);
    } catch {
      // A preferência é opcional; a troca de visualização ainda deve funcionar.
    }
  }

  return [view, updateView] as const;
}

export function normalizeCatalogSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function matchesCatalogSearch(values: unknown[], query: string) {
  const terms = normalizeCatalogSearch(query).split(" ").filter(Boolean);
  if (terms.length === 0) return true;

  const searchableText = normalizeCatalogSearch(values.join(" "));
  return terms.every((term) => searchableText.includes(term));
}

export function CatalogToolbar({
  query,
  onQueryChange,
  view,
  onViewChange,
  searchLabel,
  placeholder,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  searchLabel: string;
  placeholder: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-md">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          aria-label={searchLabel}
          placeholder={placeholder}
          className={cn("pl-9", query && "pr-10")}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 rounded-lg p-1.5 text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className="grid grid-cols-2 rounded-xl border border-graphite/10 bg-surface p-1"
        role="group"
        aria-label="Modo de visualização"
      >
        <ViewButton
          active={view === "cards"}
          onClick={() => onViewChange("cards")}
          icon={<LayoutGrid className="h-4 w-4" />}
        >
          Cards
        </ViewButton>
        <ViewButton
          active={view === "table"}
          onClick={() => onViewChange("table")}
          icon={<List className="h-4 w-4" />}
        >
          Tabela
        </ViewButton>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
        active
          ? "bg-orange text-white shadow-sm"
          : "text-gray-neutral hover:bg-surface-muted hover:text-graphite",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
