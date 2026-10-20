"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";
import { DatePicker, cn } from "@mylivepet/ui";

/**
 * Filtro de período (data inicial/final) para o histórico de atendimentos.
 * Fica recolhido num botão — quase sempre o tutor só rola a lista — e abre
 * sozinho quando já há um período aplicado.
 */
export function AppointmentsDateFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(Boolean(from || to));

  function push(params: URLSearchParams) {
    const qs = params.toString();
    router.replace(qs ? `/atendimentos?${qs}` : "/atendimentos", { scroll: false });
  }

  function update(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    push(params);
  }

  /** Limpa só o período; um filtro de pet vindo da home é preservado. */
  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    push(params);
  }

  const active = Boolean(from || to);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-full border border-graphite/15 bg-surface px-3.5 text-xs font-medium text-graphite transition-colors hover:border-orange/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2",
        )}
      >
        <CalendarRange className="h-4 w-4 text-petrol" aria-hidden /> Filtrar por período
      </button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[8rem]">
        <label htmlFor="from" className="mb-1.5 block text-xs font-medium text-gray-neutral">
          De
        </label>
        <DatePicker
          id="from"
          mode="date"
          value={from ?? ""}
          max={to || undefined}
          onChange={(v) => update("from", v)}
        />
      </div>
      <div className="flex-1 min-w-[8rem]">
        <label htmlFor="to" className="mb-1.5 block text-xs font-medium text-gray-neutral">
          Até
        </label>
        <DatePicker
          id="to"
          mode="date"
          value={to ?? ""}
          min={from || undefined}
          onChange={(v) => update("to", v)}
        />
      </div>
      <button
        type="button"
        onClick={() => {
          if (active) clear();
          setOpen(false);
        }}
        className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite"
      >
        <X className="h-4 w-4" /> {active ? "Limpar" : "Fechar"}
      </button>
    </div>
  );
}
