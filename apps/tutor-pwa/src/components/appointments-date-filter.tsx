"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { DatePicker } from "@mylivepet/ui";

/** Filtro de período (data inicial/final) para o histórico de atendimentos. */
export function AppointmentsDateFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.replace(qs ? `/atendimentos?${qs}` : "/atendimentos", { scroll: false });
  }

  const active = Boolean(from || to);

  return (
    <div className="flex flex-wrap items-end gap-3">
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
      {active && (
        <button
          type="button"
          onClick={() => router.replace("/atendimentos", { scroll: false })}
          className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-gray-neutral transition-colors hover:bg-surface-muted hover:text-graphite"
        >
          <X className="h-4 w-4" /> Limpar
        </button>
      )}
    </div>
  );
}
