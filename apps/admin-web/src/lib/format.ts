const TZ = "America/Sao_Paulo";

export function brl(cents: number | null | undefined, opts: { compact?: boolean } = {}) {
  const value = (cents ?? 0) / 100;
  if (opts.compact && Math.abs(value) >= 10_000) {
    return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function num(value: number | null | undefined) {
  return (value ?? 0).toLocaleString("pt-BR");
}

export function dateBR(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dateTimeBR(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeBR(date: Date) {
  return date.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function monthYear(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleDateString("pt-BR", { timeZone: TZ, month: "short", year: "numeric" })
    .replace(". de ", "/")
    .replace(" de ", "/");
}

/** "há 3 min", "há 2 h", "ontem", "há 12 dias". */
export function relative(iso: string | null | undefined) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return "ontem";
  if (d < 60) return `há ${d} dias`;
  return dateBR(iso);
}

/** "em 1 h 35", "vencido há 20 min". */
export function until(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(Math.round(diff / 60_000));
  const label = abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60}` : ""}`;
  return diff >= 0 ? `em ${label}` : `vencido há ${label}`;
}

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
