"use client";

import * as React from "react";
import { cn } from "./cn";

type Props = {
  name: string;
  accept?: string;
  previewSrc?: string | null;
  id?: string;
  className?: string;
};

/** Upload de imagem estilizado: área tracejada, nome do arquivo e preview. */
export function FileInput({ name, accept = "image/*", previewSrc, id, className }: Props) {
  const [preview, setPreview] = React.useState<string | null>(previewSrc ?? null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-graphite/25 bg-surface p-3 transition-colors hover:border-orange hover:bg-orange/5",
        className,
      )}
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted text-gray-neutral">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-graphite">
          {fileName ?? (preview ? "Trocar imagem" : "Escolher imagem")}
        </span>
        <span className="block truncate text-xs text-gray-neutral">
          {fileName ? "Clique para trocar" : "PNG, JPG ou WEBP"}
        </span>
      </span>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        onChange={onChange}
        className="sr-only"
      />
    </label>
  );
}
