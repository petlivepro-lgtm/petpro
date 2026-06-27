"use client";

import * as React from "react";
import { cn } from "./cn";

type NewItem = { file: File; url: string };

type Props = {
  name: string;
  defaultUrls?: string[];
  max?: number;
  accept?: string;
  /** Abre a câmera no celular (ex.: "environment" = traseira). */
  capture?: boolean | "user" | "environment";
  id?: string;
  className?: string;
};

/**
 * Galeria de upload (até `max` fotos). Mantém URLs existentes + arquivos novos.
 * Envia ao form:
 *  - `${name}_kept`: JSON das URLs mantidas;
 *  - `${name}`: input file múltiplo (FileList sincronizada via DataTransfer).
 */
export function PhotoGalleryInput({
  name,
  defaultUrls = [],
  max = 5,
  accept = "image/*",
  capture,
  id,
  className,
}: Props) {
  const [kept, setKept] = React.useState<string[]>(defaultUrls);
  const [items, setItems] = React.useState<NewItem[]>([]);
  const pickerRef = React.useRef<HTMLInputElement>(null);
  const submitRef = React.useRef<HTMLInputElement>(null);

  const total = kept.length + items.length;

  // mantém a FileList do input de submit em sincronia com os arquivos novos
  React.useEffect(() => {
    if (!submitRef.current) return;
    const dt = new DataTransfer();
    items.forEach((it) => dt.items.add(it.file));
    submitRef.current.files = dt.files;
  }, [items]);

  // libera object URLs ao desmontar
  React.useEffect(() => {
    return () => items.forEach((it) => URL.revokeObjectURL(it.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const room = max - total;
    const next = picked.slice(0, Math.max(0, room)).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    setItems((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  function removeKept(url: string) {
    setKept((prev) => prev.filter((u) => u !== url));
  }

  function removeItem(url: string) {
    setItems((prev) => {
      const found = prev.find((it) => it.url === url);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((it) => it.url !== url);
    });
  }

  const thumbs: { key: string; url: string; onRemove: () => void; cover: boolean }[] = [
    ...kept.map((url, i) => ({ key: `k-${url}`, url, onRemove: () => removeKept(url), cover: i === 0 })),
    ...items.map((it, i) => ({
      key: `n-${it.url}`,
      url: it.url,
      onRemove: () => removeItem(it.url),
      cover: kept.length === 0 && i === 0,
    })),
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {thumbs.map((t) => (
          <div
            key={t.key}
            className="group relative aspect-square overflow-hidden rounded-xl border border-graphite/10 bg-surface-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.url} alt="" className="h-full w-full object-cover" />
            {t.cover && (
              <span className="absolute left-1 top-1 rounded-md bg-graphite/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                Capa
              </span>
            )}
            <button
              type="button"
              onClick={t.onRemove}
              aria-label="Remover foto"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-graphite/70 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}

        {total < max && (
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-graphite/25 bg-surface text-gray-neutral transition-colors hover:border-orange hover:bg-orange/5 hover:text-orange"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-medium">Adicionar</span>
          </button>
        )}
      </div>

      <p className="text-xs text-gray-neutral">
        {total}/{max} fotos · a primeira é a capa
      </p>

      {/* picker visível-oculto para adicionar */}
      <input
        id={id}
        ref={pickerRef}
        type="file"
        accept={accept}
        capture={capture}
        multiple
        onChange={onPick}
        className="sr-only"
      />
      {/* input de submit com a FileList dos novos arquivos */}
      <input ref={submitRef} type="file" name={name} multiple className="sr-only" tabIndex={-1} aria-hidden />
      {/* URLs mantidas */}
      <input type="hidden" name={`${name}_kept`} value={JSON.stringify(kept)} />
    </div>
  );
}
