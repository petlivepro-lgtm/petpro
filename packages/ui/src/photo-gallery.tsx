"use client";

import * as React from "react";
import { cn } from "./cn";

/** Galeria de exibição: imagem principal + miniaturas clicáveis. */
export function PhotoGallery({
  photos,
  alt = "",
  className,
}: {
  photos: string[];
  alt?: string;
  className?: string;
}) {
  const [active, setActive] = React.useState(0);

  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-square w-full items-center justify-center rounded-2xl bg-surface-muted text-gray-neutral/50",
          className,
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10">
          <path
            d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm0 11 4.5-4.5 3 3L15 11l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="9" r="1.4" fill="currentColor" />
        </svg>
      </div>
    );
  }

  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="aspect-square w-full overflow-hidden rounded-2xl bg-surface-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current} alt={alt} className="h-full w-full object-cover" />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                i === active ? "border-orange" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
