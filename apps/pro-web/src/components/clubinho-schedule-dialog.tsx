"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { Button, Dialog, Label, Select, SLOT_MINUTES } from "@mylivepet/ui";
import {
  WEEKDAYS,
  WEEKDAY_LABEL,
  type ClubinhoSubscriptionDTO,
  type Weekday,
} from "@mylivepet/types";
import type { BookingCollaborator } from "@/lib/booking-options";
import { hhmm, scheduleByDay } from "@/lib/collaborator-schedule";
import {
  saveClubinhoSchedule,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/** "08:00" + 30min → "08:30". Trabalha em minutos para não passar por Date. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/**
 * Cadastra o combinado do Clubinho: "toda sexta às 11h, banho e tosa, com a
 * Ana".
 *
 * Os horários oferecidos são só os que cabem na jornada do profissional
 * naquele dia — a mesma grade de 30 minutos que o resto da agenda usa. Um
 * horário fora da jornada não seria recusado pelo banco (só o choque com
 * outro atendimento é), mas viraria um agendamento toda semana num horário em
 * que não tem ninguém na loja.
 */
export function ClubinhoScheduleDialog({
  subscription,
  collaborators,
}: {
  subscription: ClubinhoSubscriptionDTO;
  collaborators: BookingCollaborator[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState<Weekday | "">("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [startTime, setStartTime] = useState("");

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    saveClubinhoSchedule,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  useEffect(() => {
    if (!open) return;
    setWeekday("");
    setCollaboratorId("");
    setStartTime("");
  }, [open]);

  // Só os serviços do plano: sem crédito daquele serviço o combinado nunca
  // seria cumprido, e o banco recusa (clubinho_schedule_check, 0052).
  const services = subscription.credits;

  const collaborator = collaborators.find((c) => c.id === collaboratorId);

  const times = useMemo(() => {
    if (!collaborator || weekday === "") return [];
    const windows = scheduleByDay(collaborator.collaborator_schedule).get(
      weekday,
    );
    if (!windows) return [];
    const slots: string[] = [];
    for (const window of [...windows].sort((a, b) =>
      a.start_time.localeCompare(b.start_time),
    )) {
      let t = hhmm(window.start_time);
      const end = hhmm(window.end_time);
      while (addMinutes(t, SLOT_MINUTES) <= end) {
        slots.push(t);
        t = addMinutes(t, SLOT_MINUTES);
      }
    }
    return slots;
  }, [collaborator, weekday]);

  // Trocar de dia ou de profissional pode deixar o horário escolhido fora da
  // nova jornada — melhor limpar do que enviar algo que não existe mais.
  useEffect(() => {
    if (startTime && !times.includes(startTime)) setStartTime("");
  }, [times, startTime]);

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <CalendarPlus className="h-4 w-4" /> Horário fixo
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Horário fixo do Clubinho"
        description={`${subscription.pet_name} passa a ser agendado sozinho, toda semana, enquanto houver saldo no ciclo.`}
      >
        <form action={formAction} className="space-y-4">
          <input
            type="hidden"
            name="subscription_id"
            value={subscription.id}
          />
          <input type="hidden" name="pet_id" value={subscription.pet_id} />

          <div>
            <Label htmlFor={`sched-service-${subscription.id}`}>
              Serviço *
            </Label>
            <Select
              id={`sched-service-${subscription.id}`}
              name="service_type_id"
              required
              defaultValue={
                services.length === 1 ? (services[0]!.service_type_id ?? "") : ""
              }
            >
              <option value="" disabled>
                Escolha o serviço do pacote
              </option>
              {services.map((credit) => (
                <option
                  key={credit.credit_id}
                  value={credit.service_type_id ?? ""}
                >
                  {credit.service_name} · {credit.quantity_total}x por ciclo
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`sched-weekday-${subscription.id}`}>
                Dia da semana *
              </Label>
              <Select
                id={`sched-weekday-${subscription.id}`}
                name="weekday"
                required
                value={weekday === "" ? "" : String(weekday)}
                onChange={(e) =>
                  setWeekday(
                    e.target.value === ""
                      ? ""
                      : (Number(e.target.value) as Weekday),
                  )
                }
              >
                <option value="" disabled>
                  Escolha o dia
                </option>
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {WEEKDAY_LABEL[day]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor={`sched-collab-${subscription.id}`}>
                Profissional *
              </Label>
              <Select
                id={`sched-collab-${subscription.id}`}
                name="collaborator_id"
                required
                value={collaboratorId}
                onChange={(e) => setCollaboratorId(e.target.value)}
              >
                <option value="" disabled>
                  Escolha o profissional
                </option>
                {collaborators.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.full_name}
                    {option.role_title ? ` · ${option.role_title}` : ""}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor={`sched-time-${subscription.id}`}>Horário *</Label>
            <Select
              id={`sched-time-${subscription.id}`}
              name="start_time"
              required
              value={startTime}
              disabled={times.length === 0}
              onChange={(e) => setStartTime(e.target.value)}
            >
              <option value="" disabled>
                {!collaboratorId || weekday === ""
                  ? "Escolha o dia e o profissional primeiro"
                  : times.length === 0
                    ? `${collaborator?.full_name ?? "O profissional"} não trabalha ${WEEKDAY_LABEL[
                        weekday
                      ].toLowerCase()}`
                    : "Escolha o horário"}
              </option>
              {times.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </Select>
          </div>

          <p className="rounded-xl bg-surface-muted p-3 text-xs text-gray-neutral">
            Os agendamentos são criados só até acabar o saldo do ciclo. Se o mês
            tiver uma semana a mais do que o pacote cobre, a data sobrando
            aparece como fora do pacote — e nada é cobrado por ela.
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
            <Button type="submit" disabled={pending || !startTime}>
              {pending ? "Salvando..." : "Salvar horário"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
