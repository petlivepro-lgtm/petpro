"use client";

import * as React from "react";
import { cn } from "./cn";
import { ColorPickerPopover } from "./color-picker-popover";
import { isLightHex, normalizeHex } from "./color-utils";

export type ColorOption = {
  /** Nome exibido ao lado do círculo e gravado no banco. */
  name: string;
  hex: string;
};

type Props = {
  options: readonly ColorOption[];
  /** Nome da cor selecionada; `null`/`""` = nenhuma. */
  value?: string | null;
  onChange?: (color: ColorOption | null) => void;
  /** Permite desmarcar clicando na cor já selecionada. */
  allowEmpty?: boolean;
  /** Cores que existem no catálogo mas estão indisponíveis (sem estoque). */
  disabledColors?: readonly string[];
  /**
   * Acrescenta no fim da fileira um botão que abre o seletor livre. Opt-in
   * porque nem toda cor é um hex solto: a variação de produto guarda nome +
   * hex juntos e o app do tutor escolhe pelo nome, então lá cor livre criaria
   * uma variação sem legenda.
   */
  allowCustom?: boolean;
  /** Cor escolhida fora da paleta, em "#RRGGBB". */
  customValue?: string | null;
  onCustomChange?: (hex: string) => void;
  /** Texto da prévia dentro do seletor (o nome do serviço). */
  customPreviewLabel?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * Seleção de cor em círculos coloridos com o nome ao lado. Usada no cadastro
 * de variações do CRM e na escolha da variação pelo tutor — o mesmo desenho
 * nos dois apps.
 *
 * "Colorido" (multicolor) é desenhado em degradê cônico em vez do hex chapado.
 */
export function ColorSwatchInput({
  options,
  value,
  onChange,
  allowEmpty = true,
  disabledColors,
  allowCustom = false,
  customValue,
  onCustomChange,
  customPreviewLabel,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const customRef = React.useRef<HTMLButtonElement>(null);
  const custom = customValue ? normalizeHex(customValue) : null;
  // A cor livre só fica "acesa" quando não é nenhuma da paleta — senão o
  // swatch nomeado e o botão apareceriam selecionados ao mesmo tempo.
  const customSelected =
    custom != null &&
    !options.some((o) => o.hex.toUpperCase() === custom);

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel ?? "Cor"}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const selected = value === option.name;
        const disabled = disabledColors?.includes(option.name) ?? false;
        return (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onChange?.(selected && allowEmpty ? null : option);
            }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-colors",
              selected
                ? "border-orange bg-orange/10 text-graphite"
                : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
              disabled && "cursor-not-allowed opacity-40 line-through hover:border-graphite/15",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-graphite/20 text-white",
                selected && "ring-2 ring-orange ring-offset-1",
              )}
              style={
                isMulticolor(option.name)
                  ? {
                      backgroundImage:
                        "conic-gradient(#DC2626,#FACC15,#16A34A,#2563EB,#7C3AED,#DC2626)",
                    }
                  : { backgroundColor: option.hex }
              }
            >
              {selected && (
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={cn("h-3 w-3", isLightHex(option.hex) && "text-graphite")}
                >
                  <path
                    d="m5 10.5 3.5 3.5L15 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {option.name}
          </button>
        );
      })}

      {allowCustom && (
        <>
          <button
            ref={customRef}
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-colors",
              customSelected
                ? "border-orange bg-orange/10 text-graphite"
                : "border-graphite/15 bg-surface text-graphite hover:border-orange/40",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-graphite/20 text-white",
                customSelected && "ring-2 ring-orange ring-offset-1",
              )}
              style={
                customSelected
                  ? { backgroundColor: custom! }
                  : {
                      backgroundImage:
                        "conic-gradient(#DC2626,#FACC15,#16A34A,#2563EB,#7C3AED,#DC2626)",
                    }
              }
            >
              {customSelected && (
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={cn("h-3 w-3", isLightHex(custom!) && "text-graphite")}
                >
                  <path
                    d="m5 10.5 3.5 3.5L15 7"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            {customSelected ? custom : "Outra cor"}
          </button>

          <ColorPickerPopover
            open={pickerOpen}
            anchorRef={customRef}
            value={custom}
            previewLabel={customPreviewLabel}
            onClose={() => setPickerOpen(false)}
            onChange={(hex) => onCustomChange?.(hex)}
          />
        </>
      )}
    </div>
  );
}

function isMulticolor(name: string): boolean {
  return name.toLowerCase() === "colorido";
}
