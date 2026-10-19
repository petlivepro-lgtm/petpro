import Link from "next/link";
import { cn } from "@mylivepet/ui";

/** Painel branco com título opcional: o container padrão do admin. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn("min-w-0 rounded-[14px] bg-surface shadow-card", padded && "p-5 md:p-[22px]", className)}>
      {(title || actions) && (
        <div className={cn("mb-4 flex flex-wrap items-center gap-x-3 gap-y-1", !padded && "px-5 pt-5")}>
          <div className="mr-auto flex min-w-0 flex-col gap-0.5">
            {title && <h2 className="font-heading text-[17px] font-bold">{title}</h2>}
            {description && <p className="text-[13px] text-gray-neutral">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "muted",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "up" | "muted" | "warn";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-surface p-[18px] shadow-card">
      <span className="text-[13px] font-medium text-gray-neutral">{label}</span>
      <span className="font-accent text-[28px] font-semibold leading-none tracking-tight tabular">{value}</span>
      {hint && (
        <span
          className={cn(
            "text-xs font-semibold",
            tone === "up" && "text-success",
            tone === "warn" && "text-[#B5442F]",
            tone === "muted" && "text-gray-neutral",
          )}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">{children}</section>;
}

const PILL_TONES = {
  green: "bg-success/[0.12] text-[#22603F]",
  petrol: "bg-petrol/[0.12] text-petrol",
  amber: "bg-warning/25 text-[#7A4F00]",
  red: "bg-danger/[0.12] text-[#9A3825]",
  gray: "bg-surface-muted text-graphite/80",
  orange: "bg-orange/[0.12] text-[#A84600]",
} as const;

export type PillTone = keyof typeof PILL_TONES;

export function Pill({ tone = "gray", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", PILL_TONES[tone])}>
      {children}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs text-graphite/80">{children}</span>;
}

/** Abas de filtro que viram parâmetro de URL (navegação, não estado local). */
export function FilterTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { href: string; label: string; count?: number; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors",
            tab.active
              ? "border-graphite bg-graphite text-white"
              : "border-graphite/15 bg-surface text-graphite hover:border-graphite/30",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn("tabular", tab.active ? "text-white/70" : "text-gray-neutral")}>{tab.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function Pagination({
  total,
  limit,
  offset,
  hrefFor,
}: {
  total: number;
  limit: number;
  offset: number;
  hrefFor: (offset: number) => string;
}) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const linkClass =
    "inline-flex min-h-[38px] items-center rounded-lg border border-graphite/15 bg-surface px-3.5 text-[13px] text-graphite transition-colors hover:border-graphite/30";
  const disabledClass = "pointer-events-none opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-[13px] text-gray-neutral">
      <span className="mr-auto tabular">
        {from}–{to} de {total}
      </span>
      <Link
        href={hrefFor(Math.max(0, offset - limit))}
        aria-disabled={offset === 0}
        className={cn(linkClass, offset === 0 && disabledClass)}
      >
        Anterior
      </Link>
      <Link
        href={hrefFor(offset + limit)}
        aria-disabled={to >= total}
        className={cn(linkClass, to >= total && disabledClass)}
      >
        Próxima
      </Link>
    </div>
  );
}

/** Tabela com rolagem horizontal própria (a página nunca rola de lado). */
export function TableBox({ children, minWidth = 720 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="scrollbar-slim overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-graphite/10 bg-[#FBFCFD] px-4 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-gray-neutral",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-b border-graphite/[0.06] px-4 py-3.5 align-middle",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}

/** Barra horizontal de proporção (funil, uso por módulo). */
export function Meter({ value, max, tone = "petrol" }: { value: number; max: number; tone?: "petrol" | "amber" }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
      <div
        className={cn("h-full rounded-full", tone === "petrol" ? "bg-petrol" : "bg-warning")}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

/** Colunas verticais simples (séries semanais/mensais). A última em laranja. */
export function Bars({
  data,
  formatValue = (v) => String(v),
  label,
}: {
  data: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="flex flex-col gap-2" aria-label={label}>
      <div className="flex h-[170px] items-end gap-2 border-b border-graphite/[0.12] px-1">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="whitespace-nowrap text-[11px] text-gray-neutral tabular">{formatValue(d.value)}</span>
            <div
              className={cn("w-full max-w-[36px] rounded-t-md rounded-b-sm", i === data.length - 1 ? "bg-orange" : "bg-petrol")}
              style={{ height: `${Math.max(2, Math.round((d.value / max) * 130))}px` }}
              title={`${d.label}: ${formatValue(d.value)}`}
            />
          </div>
        ))}
      </div>
      <figcaption className="flex gap-2 px-1">
        {data.map((d, i) => (
          <span key={`${d.label}-c-${i}`} className="flex-1 text-center text-[11px] text-gray-neutral">
            {d.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export function SrOnly({ children }: { children: React.ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
