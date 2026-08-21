"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";
import { Input } from "./input";
import {
  hexToHsv,
  hsvToHex,
  normalizeHex,
  readableInk,
  type Hsv,
} from "./color-utils";

const FALLBACK = "#2D6CDF";

/**
 * Seleção livre de cor: área de saturação/brilho, faixa de matiz e o
 * hexadecimal digitável.
 *
 * Não usa `<input type="color">` de propósito — o seletor nativo é uma janela
 * do sistema operacional, com a cara de cada SO, e foge da identidade da marca
 * pelo mesmo motivo que o calendário nativo já é proibido no projeto.
 *
 * O painel é renderizado em portal com `position: fixed` e vira para cima
 * quando falta espaço, igual a DatePicker e Select: o campo vive dentro de um
 * Dialog, e um dropdown comum seria cortado pelo overflow do card.
 */
export function ColorPickerPopover({
  open,
  anchorRef,
  value,
  onClose,
  onChange,
  previewLabel = "Serviço",
}: {
  open: boolean;
  /** Elemento que ancora o painel (o botão que abriu). */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Cor atual em "#RRGGBB", ou `null` para começar de um azul. */
  value: string | null;
  onClose: () => void;
  /** Só dispara ao confirmar — mexer nos controles não grava nada ainda. */
  onChange: (hex: string) => void;
  /** Texto da prévia; use o nome do serviço para ver o badge de verdade. */
  previewLabel?: string;
}) {
  const popRef = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(
    null,
  );
  const [hsv, setHsv] = React.useState<Hsv>(() =>
    hexToHsv(value ?? FALLBACK),
  );
  // O campo de texto guarda o que foi digitado, não o hex válido: quem digita
  // "#2d6" passa por estados inválidos antes de chegar no que quer.
  const [typed, setTyped] = React.useState(value ?? FALLBACK);

  const hex = hsvToHex(hsv);

  React.useEffect(() => setMounted(true), []);

  // Reabrir sempre parte da cor que está valendo, não da última mexida.
  //
  // Sem `setPos(null)` aqui de propósito: este efeito é passivo e roda DEPOIS
  // do useLayoutEffect que calcula a posição, então zerar o estado apagaria a
  // medida recém-feita e o painel ficaria invisível para sempre.
  React.useEffect(() => {
    if (!open) return;
    const start = value ?? FALLBACK;
    setHsv(hexToHsv(start));
    setTyped(start);
  }, [open, value]);

  const updatePos = React.useCallback(() => {
    const anchor = anchorRef.current;
    const pop = popRef.current;
    if (!anchor || !pop) return;
    const r = anchor.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(
      margin,
      Math.min(r.left, window.innerWidth - pop.offsetWidth - margin),
    );
    let top = r.bottom + margin;
    if (
      top + pop.offsetHeight > window.innerHeight - margin &&
      r.top - pop.offsetHeight - margin > 0
    ) {
      top = r.top - pop.offsetHeight - margin;
    }
    top = Math.max(
      margin,
      Math.min(top, window.innerHeight - pop.offsetHeight - margin),
    );
    setPos({ top, left });
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open, updatePos]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  const commit = () => {
    onChange(hex);
    onClose();
  };

  const ink = readableInk(hex);

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label="Escolher outra cor"
      className="z-[100] w-72 rounded-2xl border border-graphite/10 bg-surface p-3 shadow-card-hover"
      style={
        pos
          ? { position: "fixed", top: pos.top, left: pos.left }
          : { position: "fixed", top: 0, left: 0, visibility: "hidden" }
      }
    >
      <SaturationArea hsv={hsv} onChange={(next) => {
        setHsv(next);
        setTyped(hsvToHex(next));
      }} />

      <HueSlider
        hue={hsv.h}
        onChange={(h) => {
          const next = { ...hsv, h };
          setHsv(next);
          setTyped(hsvToHex(next));
        }}
      />

      <div className="mt-3 flex items-center gap-2">
        <span
          aria-hidden
          className="h-9 w-9 shrink-0 rounded-xl border border-graphite/20"
          style={{ backgroundColor: hex }}
        />
        <Input
          value={typed}
          onChange={(e) => {
            const raw = e.target.value;
            setTyped(raw);
            const valid = normalizeHex(raw);
            if (valid) setHsv(hexToHsv(valid));
          }}
          onBlur={() => setTyped(hex)}
          aria-label="Código hexadecimal da cor"
          spellCheck={false}
          className="font-mono uppercase"
        />
      </div>

      {/* A prévia mostra o badge como ele sai no card da agenda, já com a
          tinta corrigida — é onde o petshop vê se a cor clara ficou legível. */}
      <div className="mt-3 rounded-xl border border-graphite/10 bg-surface-muted p-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-neutral">
          Na agenda
        </p>
        <span
          className="inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight"
          style={{ background: `${hex}1F`, color: ink }}
        >
          {previewLabel}
        </span>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button size="sm" type="button" onClick={commit}>
          Usar cor
        </Button>
      </div>
    </div>,
    document.body,
  );
}

/** Arraste em duas dimensões: saturação no eixo X, brilho no Y. */
function SaturationArea({
  hsv,
  onChange,
}: {
  hsv: Hsv;
  onChange: (next: Hsv) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const apply = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const s = clamp01((clientX - r.left) / r.width);
    const v = 1 - clamp01((clientY - r.top) / r.height);
    onChange({ ...hsv, s, v });
  };

  return (
    <div
      ref={ref}
      role="application"
      aria-label="Saturação e brilho"
      className="relative h-36 w-full cursor-crosshair rounded-xl border border-graphite/10"
      style={{
        backgroundImage:
          "linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))",
        backgroundColor: hsvToHex({ h: hsv.h, s: 1, v: 1 }),
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        apply(e.clientX, e.clientY);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${hsv.s * 100}%`,
          top: `${(1 - hsv.v) * 100}%`,
          backgroundColor: hsvToHex(hsv),
        }}
      />
    </div>
  );
}

function HueSlider({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  const apply = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onChange(clamp01((clientX - r.left) / r.width) * 360);
  };

  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Matiz"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={Math.round(hue)}
      tabIndex={0}
      className="relative mt-3 h-4 w-full cursor-pointer rounded-full border border-graphite/10"
      style={{
        backgroundImage:
          "linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)",
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        apply(e.clientX);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onChange((hue + 355) % 360);
        if (e.key === "ArrowRight") onChange((hue + 5) % 360);
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={{
          left: `${(hue / 360) * 100}%`,
          backgroundColor: hsvToHex({ h: hue, s: 1, v: 1 }),
        }}
      />
    </div>
  );
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
