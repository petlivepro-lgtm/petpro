import { CalendarClock } from "lucide-react";
import { cn } from "@mylivepet/ui";
import { daysUntil, type ClubinhoSubscriptionDTO } from "@mylivepet/types";

/** Data curta "12/08" a partir de um `date` do Postgres. */
function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Saldo do ciclo corrente: quantos atendimentos de cada serviço ainda restam.
 * É a resposta à pergunta do balcão — "quantos banhos ele ainda tem?" — e por
 * isso o número que restou vem grande, não a porcentagem consumida.
 *
 * Sem período corrente (ciclo vencido antes da renovação) mostra o aviso em
 * vez de um saldo zerado, que leria como "acabou o pacote".
 */
export function ClubinhoBalance({
  subscription,
  className,
}: {
  subscription: ClubinhoSubscriptionDTO;
  className?: string;
}) {
  const remaining = daysUntil(subscription.current_period_end);

  if (!subscription.period_id) {
    return (
      <p className={cn("text-sm text-warning", className)}>
        Ciclo vencido em {shortDate(subscription.period_end)} — o saldo volta na
        próxima renovação.
      </p>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {subscription.credits.map((credit) => {
        const used = credit.quantity_total
          ? credit.quantity_used / credit.quantity_total
          : 0;
        const empty = credit.quantity_left === 0;
        return (
          <div key={credit.credit_id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-sm text-graphite">
                {credit.service_name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm tabular-nums",
                  empty ? "text-gray-neutral" : "font-semibold text-graphite",
                )}
              >
                <strong
                  className={cn(
                    "font-heading text-base",
                    empty ? "text-gray-neutral" : "text-petrol",
                  )}
                >
                  {credit.quantity_left}
                </strong>
                <span className="text-gray-neutral">
                  {" "}
                  de {credit.quantity_total}
                </span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite/10">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  empty ? "bg-gray-neutral/40" : "bg-petrol",
                )}
                style={{ width: `${Math.round((1 - used) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}

      <p className="flex items-center gap-1.5 pt-0.5 text-xs text-gray-neutral">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        Ciclo até {shortDate(subscription.current_period_end)}
        {remaining !== null &&
          (remaining >= 0
            ? ` · ${remaining} dia${remaining === 1 ? "" : "s"}`
            : " · vencido")}
        {subscription.plan_rollover && " · o que sobrar acumula"}
        {!subscription.auto_renew && " · não renova sozinho"}
      </p>
    </div>
  );
}
