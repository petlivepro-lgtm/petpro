import { cn } from "@mylivepet/ui";
import { dateTile } from "@/lib/home";

/** Bloco de data (dia da semana, dia e mês) da home e do histórico. */
export function DateTile({ iso, size = "md" }: { iso: string; size?: "sm" | "md" }) {
  const { day, month, weekday } = dateTile(iso);
  return (
    <span
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-xl bg-petrol/[0.07] text-center leading-none",
        size === "md" ? "h-[4.5rem] w-16 gap-1" : "h-12 w-12 gap-0.5",
      )}
    >
      {size === "md" && (
        <span className="text-[11px] font-semibold capitalize text-petrol">{weekday}</span>
      )}
      <span
        className={cn(
          "font-heading font-bold tabular-nums text-graphite",
          size === "md" ? "text-2xl" : "text-base",
        )}
      >
        {day}
      </span>
      <span className="text-[11px] capitalize text-gray-neutral">{month}</span>
    </span>
  );
}
