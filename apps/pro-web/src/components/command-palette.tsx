"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { Dialog, Input, cn } from "@mylivepet/ui";
import type { StaffRole } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import {
  GROUP_LABEL,
  MIN_SEARCH_LENGTH,
  groupHits,
  searchRecords,
  searchStatic,
  type SearchHit,
} from "@/lib/search";

/** Evento que qualquer canto do painel dispara para abrir a paleta. */
export const SEARCH_OPEN_EVENT = "mylivepet:search-open";

export function openCommandPalette() {
  window.dispatchEvent(new Event(SEARCH_OPEN_EVENT));
}

const DEBOUNCE_MS = 220;

/**
 * A busca do painel inteiro: Ctrl+K (⌘K no Mac) em qualquer página.
 *
 * Páginas e ações são resolvidas aqui mesmo e aparecem na primeira tecla; os
 * registros vêm da RPC `global_search`, que é uma consulta só para as seis
 * tabelas — seis viagens por tecla digitada seria uma lista que sempre chega
 * tarde.
 *
 * Fica montada uma vez no layout do painel, e não por página: o atalho tem
 * que responder onde quer que a pessoa esteja.
 */
export function CommandPalette({
  tenantId,
  role,
}: {
  tenantId: string | null;
  role?: StaffRole;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [records, setRecords] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl+K abre de qualquer lugar, e fecha se já estiver aberta — é o mesmo
  // gesto de ida e volta que todo mundo já tem no dedo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key?.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(SEARCH_OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(SEARCH_OPEN_EVENT, onOpen);
    };
  }, []);

  // Fechar zera a busca: a paleta reabre pronta para outra pergunta.
  useEffect(() => {
    if (open) return;
    setTerm("");
    setRecords([]);
    setActive(0);
  }, [open]);

  useEffect(() => {
    if (!open || !tenantId) return;
    const query = term.trim();
    if (query.length < MIN_SEARCH_LENGTH) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let alive = true;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const hits = await searchRecords(supabase, tenantId, query);
      // Digitar rápido dispara várias buscas; a resposta de um termo que já
      // não está na caixa não pode sobrescrever a do termo atual.
      if (!alive) return;
      setRecords(hits);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, term, tenantId]);

  const hits = useMemo(
    () => [...searchStatic(term, role), ...records],
    [term, role, records],
  );
  const groups = useMemo(() => groupHits(hits), [hits]);

  // A lista muda a cada tecla; o destaque volta para o primeiro item, que é o
  // que o Enter abriria. Com a caixa vazia nada fica destacado: abrir a paleta
  // e apertar Enter sem querer não pode cair num formulário de cadastro.
  useEffect(() => setActive(term.trim() ? 0 : -1), [term]);
  useEffect(() => {
    if (active < hits.length) return;
    setActive(hits.length > 0 ? hits.length - 1 : 0);
  }, [active, hits.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector("[data-active='true']")
      ?.scrollIntoView({ block: "nearest" });
  }, [active, groups]);

  const openHit = useCallback(
    (hit: SearchHit | undefined) => {
      if (!hit) return;
      setOpen(false);
      router.push(hit.href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (hits.length ? (i + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      openHit(hits[active]);
    }
  };

  const searching = term.trim().length >= MIN_SEARCH_LENGTH;
  const empty = searching && !loading && hits.length === 0;

  // O índice global cresce enquanto as seções são desenhadas: a navegação por
  // teclado atravessa os grupos como se fosse uma lista só.
  let index = -1;

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      className="p-0 sm:max-w-xl"
    >
      <div className="flex items-center gap-2 border-b border-graphite/10 px-4">
        <Search className="h-4 w-4 shrink-0 text-gray-neutral" />
        <Input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Buscar pets, tutores, atendimentos, páginas..."
          aria-label="Buscar no painel"
          className="h-14 rounded-none border-0 bg-transparent px-0 text-base focus-visible:ring-0"
        />
        {loading && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-neutral" />
        )}
      </div>

      <div ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
        {groups.map(([group, list]) => (
          <div key={group} className="mb-1 last:mb-0">
            <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-neutral">
              {GROUP_LABEL[group]}
            </p>
            {list.map((hit) => {
              index += 1;
              const current = index;
              const Icon = hit.icon;
              return (
                <button
                  key={hit.key}
                  type="button"
                  data-active={current === active}
                  onMouseMove={() => setActive(current)}
                  onClick={() => openHit(hit)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors",
                    current === active
                      ? "bg-orange/10"
                      : "hover:bg-surface-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      current === active ? "text-orange" : "text-gray-neutral",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-graphite">
                      {hit.title}
                    </span>
                    {hit.subtitle && (
                      <span className="block truncate text-xs text-gray-neutral">
                        {hit.subtitle}
                      </span>
                    )}
                  </span>
                  {hit.badge && (
                    <span className="shrink-0 rounded-lg bg-surface-muted px-2 py-0.5 text-[11px] text-gray-neutral">
                      {hit.badge}
                    </span>
                  )}
                  {current === active && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-orange" />
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {empty && (
          <p className="px-2 py-6 text-center text-sm text-gray-neutral">
            Nada encontrado para “{term.trim()}”.
          </p>
        )}

        {!searching && (
          <p className="px-2 py-3 text-center text-xs text-gray-neutral">
            Digite pelo menos {MIN_SEARCH_LENGTH} letras para buscar pets,
            tutores, atendimentos, serviços e produtos.
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 border-t border-graphite/10 px-4 py-2 text-[11px] text-gray-neutral">
        <span>
          <Key>↑</Key> <Key>↓</Key> navegar
        </span>
        <span>
          <Key>↵</Key> abrir
        </span>
        <span>
          <Key>esc</Key> fechar
        </span>
      </div>
    </Dialog>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-graphite/15 bg-surface-muted px-1.5 py-0.5 font-sans text-[10px] text-graphite">
      {children}
    </kbd>
  );
}
