"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input, cn } from "@mylivepet/ui";

export type SuggestKind = "petshops" | "tutores" | "identidade";

export type Suggestion = {
  /** Para onde o clique leva (caminho interno). */
  href: string;
  title: string;
  /** Linha de apoio: só o que a tela já mostra (dados pessoais mascarados). */
  detail: string;
  tags: string[];
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 220;

/** Destaca o trecho digitado no título (sem diferenciar maiúsculas). */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-petrol underline decoration-petrol/30 underline-offset-2">{text.slice(i, i + term.length)}</span>
      {text.slice(i + term.length)}
    </>
  );
}

/**
 * Campo de busca que sugere resultados enquanto se digita (combobox).
 * Escolher uma sugestão leva direto ao registro; Enter sem sugestão marcada
 * envia o formulário normalmente, como a busca de antes.
 */
export function SuggestInput({
  kind,
  id,
  name,
  defaultValue = "",
  placeholder,
  maxLength = 120,
  type = "search",
}: {
  kind: SuggestKind;
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
  type?: "search" | "text";
}) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState("");
  const seq = useRef(0);
  // Só busca depois que a pessoa digita: o valor que veio da URL não abre a lista.
  const typed = useRef(false);

  useEffect(() => {
    const term = value.trim();
    if (!typed.current) return;
    if (term.length < MIN_CHARS) {
      seq.current++;
      setItems([]);
      setLoading(false);
      setOpen(false);
      return;
    }
    const mine = ++seq.current;
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sugestoes?${new URLSearchParams({ tipo: kind, q: term })}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        const data = res.ok ? ((await res.json()) as { items: Suggestion[] }) : { items: [] };
        if (mine !== seq.current) return;
        setItems(data.items);
        setSearched(term);
        setActive(-1);
        setOpen(true);
      } catch {
        // Abortada por uma letra nova, ou rede: a busca normal continua valendo.
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, kind]);

  function choose(s: Suggestion) {
    setOpen(false);
    router.push(s.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && open && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    }
  }

  const showList = open && value.trim().length >= MIN_CHARS;
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => {
          typed.current = true;
          setValue(e.target.value);
        }}
        onFocus={() => items.length && value.trim().length >= MIN_CHARS && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
        className={cn("focus-visible:ring-petrol", loading && "pr-10")}
      />
      {loading && (
        <Loader2 className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 animate-spin text-gray-neutral" aria-hidden />
      )}
      {showList && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-graphite/10 bg-surface shadow-card-hover">
          {items.length ? (
            <ul id={listId} role="listbox" aria-label="Sugestões" className="max-h-[min(60vh,380px)] overflow-y-auto p-1.5">
              {items.map((s, i) => (
                <li
                  key={s.href}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  // mousedown antes do blur: o clique não perde a lista.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(s)}
                  onMouseMove={() => i !== active && setActive(i)}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2.5 transition-colors",
                    i === active ? "bg-surface-muted" : "bg-transparent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate text-sm font-semibold text-graphite">
                      <Highlight text={s.title} term={searched} />
                    </span>
                    {s.tags.map((t) => (
                      <span key={t} className="shrink-0 rounded-md bg-petrol/[0.08] px-1.5 py-0.5 text-[11px] font-semibold text-petrol">
                        {t}
                      </span>
                    ))}
                  </span>
                  {s.detail && <span className="truncate text-xs text-gray-neutral tabular">{s.detail}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p id={listId} className="px-4 py-3 text-sm text-gray-neutral">
              {loading ? "Buscando…" : "Nada encontrado com esse termo."}
            </p>
          )}
          <p className="hidden border-t border-graphite/[0.08] px-4 py-2 text-[11px] text-gray-neutral sm:block">
            ↑ ↓ para escolher · Enter abre · Esc fecha
          </p>
        </div>
      )}
    </div>
  );
}
