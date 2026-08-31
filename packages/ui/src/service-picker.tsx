"use client";

import * as React from "react";
import { formatBRL } from "@mylivepet/types";

// Ícones inline: o design system não depende de biblioteca de ícones — quem
// precisa de um ícone variável recebe por prop (ver ActionTile).
const svg = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

const Check = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 20 20" className={className} {...svg} strokeWidth={3}>
    <path d="m5 10.5 3.5 3.5L15 7" />
  </svg>
);

const ChevronDown = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...svg}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const Clock = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...svg}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const X = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} {...svg}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

/** Compara ignorando caixa e acento: "unha" acha "Corte de unha". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A partir daqui a lista fica longa o bastante para a busca compensar. */
const SEARCH_THRESHOLD = 5;

export type ServiceOption = {
  id: string;
  name: string;
  price_cents: number;
  /** Ausente no serviço adicional, que não ocupa horário. */
  duration_min?: number | null;
};

/** Textos do seletor. O padrão fala de serviço; adicionais passam os seus. */
export type ServicePickerLabels = {
  /** Texto do botão fechado, sem nada selecionado. */
  placeholder?: string;
  /** Aviso abaixo do campo enquanto nada foi escolhido; null esconde. */
  hint?: string | null;
  noun?: string;
  nounPlural?: string;
  searchPlaceholder?: string;
  /** Busca sem resultado. */
  empty?: string;
};

const DEFAULT_LABELS: Required<ServicePickerLabels> = {
  placeholder: "Selecione um ou mais serviços",
  hint: "Selecione ao menos um serviço.",
  noun: "serviço",
  nounPlural: "serviços",
  searchPlaceholder: "Buscar serviço...",
  empty: "Nenhum serviço encontrado.",
};

/**
 * Seletor de múltiplos serviços: fechado por padrão, abre uma lista em popover.
 * Emite um input hidden por serviço escolhido (lido com formData.getAll), então
 * funciona igual no formulário do tutor e no diálogo do petshop.
 *
 * Serve também aos serviços adicionais (0056): mesma mecânica, trocando os
 * rótulos por `labels` — item sem duração simplesmente não a exibe.
 */
export function ServicePicker({
  services,
  selected,
  toggle,
  name = "service_type_id",
  searchable,
  labels,
}: {
  services: ServiceOption[];
  selected: Set<string>;
  toggle: (id: string) => void;
  /** Nome do campo enviado ao server action. */
  name?: string;
  /**
   * Campo de busca no topo da lista. Por padrão aparece sozinho a partir de
   * cinco serviços; passe `searchable` para exibi-lo desde já.
   */
  searchable?: boolean;
  labels?: ServicePickerLabels;
}) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Buscar em uma opção só não ajuda ninguém, nem quando pedida explicitamente.
  const showSearch =
    services.length >= 2 && (searchable ?? services.length >= SEARCH_THRESHOLD);
  const term = normalize(query.trim());
  const visible =
    showSearch && term
      ? services.filter((s) => normalize(s.name).includes(term))
      : services;

  // Fecha ao clicar fora ou pressionar Esc.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, showSearch]);

  const chosen = services.filter((s) => selected.has(s.id));
  const totalCents = chosen.reduce((sum, s) => sum + s.price_cents, 0);
  const totalMin = chosen.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);
  const count = chosen.length;

  const summary =
    count === 0
      ? copy.placeholder
      : count === 1
        ? (chosen[0]?.name ?? "")
        : `${count} ${copy.nounPlural} selecionados`;

  return (
    <div className="relative" ref={ref}>
      {/* IDs selecionados enviados ao server action (lidos com formData.getAll). */}
      {chosen.map((s) => (
        <input key={s.id} type="hidden" name={name} value={s.id} />
      ))}

      {/* Botão fechado, com o mesmo visual do Select. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface pl-3 pr-3 text-sm transition-colors " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange " +
          (open ? "border-orange ring-2 ring-orange/40" : "border-graphite/15")
        }
      >
        <span
          className={
            "truncate " +
            (count === 0 ? "text-gray-neutral/80" : "text-graphite")
          }
        >
          {summary}
        </span>
        <ChevronDown
          className={
            "h-4 w-4 shrink-0 text-gray-neutral transition-transform " +
            (open ? "rotate-180" : "")
          }
        />
      </button>

      {/* Lista em popover — não polui a página quando há muitos serviços. */}
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-graphite/15 bg-surface p-1.5 shadow-lg">
          {showSearch && (
            // Fica colado no topo enquanto a lista rola.
            <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 border-b border-graphite/10 bg-surface px-1.5 pb-1.5 pt-1.5">
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-graphite/15 bg-surface px-3 text-sm text-graphite placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
              />
            </div>
          )}

          {visible.length === 0 && (
            <p className="px-3 py-2.5 text-sm text-gray-neutral">
              {copy.empty}
            </p>
          )}

          <ul className="space-y-1">
            {visible.map((s) => {
              const isOn = selected.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggle(s.id)}
                    className={
                      "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors " +
                      (isOn
                        ? "border-orange bg-orange/5"
                        : "border-transparent hover:bg-surface-muted")
                    }
                  >
                    <span
                      className={
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors " +
                        (isOn
                          ? "border-orange bg-orange text-white"
                          : "border-graphite/25 bg-surface")
                      }
                    >
                      {isOn && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-graphite">
                        {s.name}
                      </span>
                      {!!s.duration_min && (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-neutral">
                          <Clock className="h-3 w-3" /> {s.duration_min}min
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-heading text-sm font-semibold text-graphite">
                      {formatBRL(s.price_cents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Resumo da seleção sempre visível (mesmo fechado): chips + total. */}
      {count > 0 ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-orange/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-orange"
              >
                {s.name}
                <button
                  type="button"
                  aria-label={`Remover ${s.name}`}
                  onClick={() => toggle(s.id)}
                  className="rounded-full p-0.5 hover:bg-orange/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
            <span className="text-gray-neutral">
              {count} {count > 1 ? copy.nounPlural : copy.noun}
              {totalMin > 0 ? ` · ${totalMin}min` : ""}
            </span>
            <span className="font-heading font-semibold text-graphite">
              {formatBRL(totalCents)}
            </span>
          </div>
        </div>
      ) : copy.hint ? (
        <p className="mt-2 text-xs text-gray-neutral">{copy.hint}</p>
      ) : null}
    </div>
  );
}
