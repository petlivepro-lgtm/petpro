"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button, Dialog, cn } from "@mylivepet/ui";
import {
  CLUBINHO_OCCURRENCE_LABEL,
  formatSchedule,
  type ClubinhoOccurrenceDTO,
  type ClubinhoOccurrenceState,
  type ClubinhoScheduleDTO,
} from "@mylivepet/types";
import {
  deleteClubinhoSchedule,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/** "28/08, 11:00" a partir do timestamptz, no fuso de quem lê. */
function occurrenceLabel(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Cor do estado da data. Só conflito e sobra pedem atenção. */
const STATE_TONE: Record<ClubinhoOccurrenceState, string> = {
  BOOKED: "text-graphite",
  DONE: "text-success",
  CANCELLED: "text-gray-neutral line-through",
  CONFLICT: "text-danger",
  NO_CREDIT: "text-gray-neutral",
};

/** O porquê, quando a data não virou agendamento. */
function reasonOf(occurrence: ClubinhoOccurrenceDTO): string | null {
  if (occurrence.state === "CONFLICT")
    return `${occurrence.collaborator_name} já estava ocupado nesse horário — remarque com o tutor`;
  if (occurrence.state === "NO_CREDIT")
    return "fora do pacote — o saldo do ciclo acabou antes desta data";
  if (occurrence.state === "CANCELLED") return "cancelado no balcão";
  return null;
}

/**
 * Os horários fixos da assinatura e as datas que eles produzem no ciclo.
 *
 * A prévia vem pronta da RPC clubinho_schedule_preview (0052): a conta de
 * "quantas datas cabem no saldo" é a mesma que a materialização faz, então a
 * tela nunca discorda da agenda.
 */
export function ClubinhoScheduleList({
  schedules,
  occurrences,
  petId,
  canManage,
  className,
  children,
}: {
  schedules: ClubinhoScheduleDTO[];
  occurrences: ClubinhoOccurrenceDTO[];
  petId: string;
  canManage: boolean;
  className?: string;
  /** O botão de adicionar, montado pela página (server component). */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-graphite">
          <CalendarClock className="h-4 w-4 text-petrol" /> Horários fixos
        </p>
        {canManage && children}
      </div>

      {schedules.length === 0 ? (
        <p className="text-sm text-gray-neutral">
          Sem horário fixo. Combine um dia e hora e o pet passa a ser agendado
          sozinho a cada ciclo, enquanto houver saldo.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {schedules.map((schedule) => (
              <li
                key={schedule.id}
                className="flex items-center gap-2 rounded-xl border border-graphite/10 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-graphite">
                    {formatSchedule(schedule)}
                  </p>
                  <p className="truncate text-xs text-gray-neutral">
                    {schedule.service_name} · {schedule.collaborator_name}
                  </p>
                </div>
                {canManage && (
                  <DeleteScheduleButton
                    schedule={schedule}
                    petId={petId}
                    pendingCount={
                      occurrences.filter(
                        (o) =>
                          o.schedule_id === schedule.id && o.state === "BOOKED",
                      ).length
                    }
                  />
                )}
              </li>
            ))}
          </ul>

          {occurrences.length > 0 && (
            <ul className="space-y-1 border-t border-graphite/5 pt-2">
              {occurrences.map((occurrence) => {
                const reason = reasonOf(occurrence);
                const row = (
                  <>
                    <span
                      className={cn(
                        "tabular-nums",
                        STATE_TONE[occurrence.state],
                      )}
                    >
                      {occurrenceLabel(occurrence.occurs_at)}
                    </span>
                    <span className="text-gray-neutral">
                      {reason ?? CLUBINHO_OCCURRENCE_LABEL[occurrence.state]}
                    </span>
                  </>
                );
                return (
                  <li
                    key={`${occurrence.schedule_id}-${occurrence.occurs_at}`}
                    className="flex flex-wrap items-baseline gap-x-2 text-xs"
                  >
                    {occurrence.appointment_id ? (
                      <Link
                        href={`/atendimentos/${occurrence.appointment_id}`}
                        className="flex flex-wrap items-baseline gap-x-2 hover:underline"
                      >
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function DeleteScheduleButton({
  schedule,
  petId,
  pendingCount,
}: {
  schedule: ClubinhoScheduleDTO;
  petId: string;
  /** Agendamentos futuros que somem junto — o aviso principal do diálogo. */
  pendingCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deleteClubinhoSchedule,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Remover ${formatSchedule(schedule)}`}
        className="shrink-0 rounded-lg p-1.5 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Remover horário fixo?"
        description={`${formatSchedule(schedule)} · ${schedule.service_name}`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={schedule.id} />
          <input type="hidden" name="pet_id" value={petId} />

          <p className="text-sm text-graphite">
            O pet deixa de ser agendado automaticamente neste dia.
            {pendingCount > 0 && (
              <>
                {" "}
                Os <strong>{pendingCount}</strong> agendamento
                {pendingCount > 1 ? "s futuros" : " futuro"} que este horário já
                criou {pendingCount > 1 ? "são cancelados" : "é cancelado"}{" "}
                junto — combine antes com o tutor.
              </>
            )}
          </p>
          <p className="text-sm text-gray-neutral">
            Atendimentos já concluídos, em andamento ou com o pet na loja não
            são tocados. O saldo do ciclo também não muda: ele continua
            disponível para agendar na mão.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Removendo..." : "Remover"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
