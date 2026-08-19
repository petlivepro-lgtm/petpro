"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

type OptionItem = { value: string; label: React.ReactNode; disabled: boolean };

/** Extrai as <option> dos children para renderizar a lista customizada. */
function parseOptions(children: React.ReactNode): OptionItem[] {
  const items: OptionItem[] = [];
  React.Children.forEach(children, (child) => {
    if (
      !React.isValidElement<React.OptionHTMLAttributes<HTMLOptionElement>>(
        child,
      )
    )
      return;
    if (child.type !== "option") return;
    items.push({
      value: String(child.props.value ?? ""),
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    });
  });
  return items;
}

/** Texto plano do label (que pode ser um nó React) para poder ser buscado. */
function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return nodeText(node.props.children);
  }
  return "";
}

/** Compara ignorando caixa e acento: "joao" acha "João". */
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A partir daqui a lista fica longa o bastante para a busca compensar. */
const SEARCH_THRESHOLD = 5;

/** Dispara um change nativo no select oculto (aciona o onChange do consumidor). */
function commitNativeValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * Campo de busca no topo da lista. Por padrão aparece sozinho a partir de
   * cinco opções; passe `searchable` para exibi-lo desde já (útil onde a lista
   * cresce com o uso, como clientes) ou `false` para nunca exibir.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
};

/**
 * Select com lista estilizada (popover próprio, no padrão do DatePicker) e
 * API compatível com o select nativo: children <option>, name/required,
 * defaultValue (não controlado) ou value+onChange (controlado). Um select
 * nativo oculto participa do formulário e da validação required.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      children,
      id,
      value,
      defaultValue,
      onChange,
      required,
      name,
      disabled,
      searchable,
      searchPlaceholder = "Buscar...",
      ...props
    },
    ref,
  ) => {
    const options = parseOptions(children);
    const isControlled = value !== undefined;

    // Sem defaultValue, o select nativo seleciona a primeira opção — replica isso.
    const [internal, setInternal] = React.useState(() =>
      String(defaultValue ?? parseOptions(children)[0]?.value ?? ""),
    );
    const current = isControlled ? String(value) : internal;
    // Placeholder disabled (ex.: "Selecione...") nunca conta como valor escolhido.
    const selected = options.find((o) => !o.disabled && o.value === current);

    const [open, setOpen] = React.useState(false);
    const [highlight, setHighlight] = React.useState(-1);
    const [query, setQuery] = React.useState("");

    const rootRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const nativeRef = React.useRef<HTMLSelectElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const searchRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => nativeRef.current!, []);

    // Opções selecionáveis (placeholder "disabled" vira o texto do botão fechado).
    const selectable = options.filter((o) => !o.disabled);
    const placeholder =
      options.find((o) => o.disabled && o.value === "")?.label ?? "Selecione";

    // Buscar uma opção só não ajuda ninguém, nem quando pedida explicitamente.
    const showSearch =
      selectable.length >= 2 &&
      (searchable ?? selectable.length >= SEARCH_THRESHOLD);
    const term = normalize(query.trim());
    const visible =
      showSearch && term
        ? selectable.filter((o) => normalize(nodeText(o.label)).includes(term))
        : selectable;

    // Posição da lista (portal com position: fixed, não é cortada por overflow).
    const [pos, setPos] = React.useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);

    const updatePos = React.useCallback(() => {
      const anchor = buttonRef.current;
      const list = listRef.current;
      if (!anchor || !list) return;
      const r = anchor.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(r.left, window.innerWidth - r.width - margin),
      );
      let top = r.bottom + margin;
      // vira para cima quando não cabe abaixo e há espaço acima
      if (
        top + list.offsetHeight > window.innerHeight - margin &&
        r.top - list.offsetHeight - margin > 0
      ) {
        top = r.top - list.offsetHeight - margin;
      }
      top = Math.max(
        margin,
        Math.min(top, window.innerHeight - list.offsetHeight - margin),
      );
      setPos({ top, left, width: r.width });
    }, []);

    React.useLayoutEffect(() => {
      if (!open) return;
      updatePos();
      window.addEventListener("resize", updatePos);
      window.addEventListener("scroll", updatePos, true);
      return () => {
        window.removeEventListener("resize", updatePos);
        window.removeEventListener("scroll", updatePos, true);
      };
    }, [open, updatePos, visible.length]);

    React.useEffect(() => {
      if (open && showSearch) searchRef.current?.focus();
    }, [open, showSearch]);

    React.useEffect(() => {
      if (!open) return;
      const onDown = (e: MouseEvent) => {
        const t = e.target as Node;
        if (rootRef.current?.contains(t) || listRef.current?.contains(t))
          return;
        closeList();
      };
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    // Mantém a opção destacada visível ao navegar pelo teclado.
    React.useEffect(() => {
      if (!open || highlight < 0) return;
      listRef.current
        ?.querySelector(`[data-index="${highlight}"]`)
        ?.scrollIntoView({ block: "nearest" });
    }, [open, highlight]);

    function openList() {
      if (disabled) return;
      const idx = selectable.findIndex((o) => o.value === current);
      setHighlight(idx >= 0 ? idx : 0);
      setQuery("");
      setPos(null);
      setOpen(true);
    }

    function closeList() {
      setQuery("");
      setOpen(false);
    }

    function pick(option: OptionItem) {
      if (!isControlled) setInternal(option.value);
      if (nativeRef.current) commitNativeValue(nativeRef.current, option.value);
      closeList();
      buttonRef.current?.focus();
    }

    /** `fromSearch`: teclas de digitação (espaço, Home/End) ficam com o campo. */
    function onKeyDown(e: React.KeyboardEvent, fromSearch = false) {
      if (!open) {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          openList();
        }
        return;
      }
      switch (e.key) {
        case "Escape":
          e.stopPropagation(); // não fecha um Dialog que esteja em volta
          closeList();
          buttonRef.current?.focus();
          break;
        case "ArrowDown":
          e.preventDefault();
          setHighlight((h) => Math.min(h + 1, visible.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlight((h) => Math.max(h - 1, 0));
          break;
        case "Home":
        case "End":
          if (fromSearch) break;
          e.preventDefault();
          setHighlight(e.key === "Home" ? 0 : visible.length - 1);
          break;
        case " ":
          if (fromSearch) break;
          e.preventDefault();
          if (visible[highlight]) pick(visible[highlight]);
          break;
        case "Enter":
          e.preventDefault();
          if (visible[highlight]) pick(visible[highlight]);
          break;
        case "Tab":
          closeList();
          break;
      }
    }

    const listboxId = id ? `${id}-listbox` : undefined;

    return (
      <div className="relative" ref={rootRef}>
        {/* Select nativo oculto: envia o valor no form e dispara a validação required. */}
        <select
          ref={nativeRef}
          name={name}
          required={required}
          disabled={disabled}
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
          value={isControlled ? value : undefined}
          defaultValue={isControlled ? undefined : defaultValue}
          onChange={onChange}
          onFocus={() => buttonRef.current?.focus()}
          {...props}
        >
          {children}
        </select>

        <button
          type="button"
          ref={buttonRef}
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          onClick={() => (open ? closeList() : openList())}
          onKeyDown={onKeyDown}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-graphite/15 bg-surface pl-3 pr-3 text-left text-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
            "disabled:cursor-not-allowed disabled:opacity-60",
            selected ? "text-graphite" : "text-gray-neutral/70",
            className,
          )}
        >
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            className={cn(
              "h-4 w-4 shrink-0 text-gray-neutral transition-transform",
              open && "rotate-180",
            )}
          >
            <path
              d="m6 8 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={listRef}
              id={listboxId}
              role="listbox"
              style={
                pos
                  ? {
                      position: "fixed",
                      top: pos.top,
                      left: pos.left,
                      width: pos.width,
                    }
                  : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
              }
              className="z-[100] max-h-64 overflow-y-auto rounded-2xl border border-graphite/10 bg-surface p-1.5 shadow-card-hover"
            >
              {showSearch && (
                // Fica colado no topo enquanto a lista rola.
                <div className="sticky -top-1.5 z-10 -mx-1.5 -mt-1.5 mb-1 border-b border-graphite/10 bg-surface px-1.5 pb-1.5 pt-1.5">
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setHighlight(0);
                    }}
                    onKeyDown={(e) => onKeyDown(e, true)}
                    className="h-9 w-full rounded-lg border border-graphite/15 bg-surface px-3 text-sm text-graphite placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
                  />
                </div>
              )}

              {visible.length === 0 && (
                <p className="px-3 py-2.5 text-sm text-gray-neutral">
                  Nenhum resultado.
                </p>
              )}

              {visible.map((o, i) => {
                const isSelected = o.value === current;
                return (
                  <div
                    key={`${o.value}-${i}`}
                    role="option"
                    aria-selected={isSelected}
                    data-index={i}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isSelected ? "font-medium text-orange" : "text-graphite",
                      highlight === i && "bg-surface-muted",
                      isSelected && highlight === i && "bg-orange/10",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && (
                      <svg
                        aria-hidden
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4 shrink-0"
                      >
                        <path
                          d="m5 10.5 3.5 3.5L15 7"
                          stroke="currentColor"
                          strokeWidth="1.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);
Select.displayName = "Select";
