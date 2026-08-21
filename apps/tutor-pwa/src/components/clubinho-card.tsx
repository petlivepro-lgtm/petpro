import { CalendarClock, CalendarCheck, Crown } from "lucide-react";
import { Avatar, Card, cn } from "@mylivepet/ui";
import {
  daysUntil,
  formatSchedule,
  type ClubinhoScheduleDTO,
  type ClubinhoSubscriptionDTO,
} from "@mylivepet/types";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * O saldo do Clubinho na visão do tutor: quantos banhos ainda cabem no mês.
 *
 * Diferente do painel do petshop, aqui não aparece nem preço nem forma de
 * pagamento — o tutor quer saber o que ainda tem direito, não a contabilidade
 * da mensalidade.
 */
export function ClubinhoCard({
  subscription,
  schedules = [],
}: {
  subscription: ClubinhoSubscriptionDTO;
  /** Horários fixos combinados com o petshop. Só leitura. */
  schedules?: ClubinhoScheduleDTO[];
}) {
  const remaining = daysUntil(subscription.current_period_end);
  const paused = subscription.status === "PAUSED";

  return (
    <Card className="min-w-[17rem] shrink-0 snap-start">
      <div className="flex items-center gap-3">
        <Avatar
          name={subscription.pet_name}
          src={subscription.pet_photo_path}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading font-semibold text-graphite">
            {subscription.pet_name}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-petrol">
            <Crown className="h-3 w-3 shrink-0" />
            {subscription.plan_name}
          </p>
        </div>
      </div>

      {paused ? (
        <p className="mt-3 border-t border-graphite/5 pt-3 text-sm text-gray-neutral">
          Assinatura pausada com o petshop. O saldo volta quando ela for
          retomada.
        </p>
      ) : !subscription.period_id ? (
        <p className="mt-3 border-t border-graphite/5 pt-3 text-sm text-gray-neutral">
          O ciclo virou em {shortDate(subscription.period_end)} — o saldo novo
          entra na renovação.
        </p>
      ) : (
        <div className="mt-3 space-y-2 border-t border-graphite/5 pt-3">
          {subscription.credits.map((credit) => {
            const empty = credit.quantity_left === 0;
            return (
              <div key={credit.credit_id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-sm text-graphite">
                    {credit.service_name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-gray-neutral">
                    <strong
                      className={cn(
                        "font-heading text-base",
                        empty ? "text-gray-neutral" : "text-petrol",
                      )}
                    >
                      {credit.quantity_left}
                    </strong>{" "}
                    de {credit.quantity_total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-graphite/10">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      empty ? "bg-gray-neutral/40" : "bg-petrol",
                    )}
                    style={{
                      width: `${
                        credit.quantity_total
                          ? Math.round(
                              (credit.quantity_left / credit.quantity_total) *
                                100,
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          <p className="flex items-center gap-1.5 pt-0.5 text-xs text-gray-neutral">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Renova em {shortDate(subscription.current_period_end)}
            {remaining !== null &&
              remaining >= 0 &&
              ` · ${remaining} dia${remaining === 1 ? "" : "s"}`}
            {subscription.plan_rollover && " · o que sobrar acumula"}
          </p>
        </div>
      )}

      {schedules.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-graphite/5 pt-3">
          {schedules.map((schedule) => (
            <p
              key={schedule.id}
              className="flex items-start gap-1.5 text-xs text-graphite"
            >
              <CalendarCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-petrol" />
              <span>
                {formatSchedule(schedule)}
                <span className="block text-gray-neutral">
                  {schedule.service_name}
                  {schedule.collaborator_name &&
                    ` · com ${schedule.collaborator_name}`}
                </span>
              </span>
            </p>
          ))}
          <p className="pt-0.5 text-xs text-gray-neutral">
            Horário combinado com o petshop — para mudar, fale com a loja.
          </p>
        </div>
      )}
    </Card>
  );
}
