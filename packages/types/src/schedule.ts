// Regras do expediente semanal do colaborador (`collaborator_schedule`, 0014).
// Mora aqui, num módulo neutro, porque as mesmas regras valem em três lugares:
// a grade de horários (SlotGrid, client), os selects de profissional (client) e
// as server actions que gravam o agendamento.

/** Uma janela de trabalho; weekday na convenção de Date.getDay() (0=domingo). */
export type ScheduleWindow = {
  weekday: number;
  start_time: string; // "08:00" ou "08:00:00"
  end_time: string;
};

/** Tamanho do bloco da grade, em minutos. */
export const SLOT_MINUTES = 30;

/** "08:00" ou "08:00:00" → minutos desde meia-noite. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

/** "YYYY-MM-DD" → dia da semana local (0=domingo). */
export function weekdayOfDateString(date: string): number {
  const [y = 0, mo = 1, d = 1] = date.split("-").map(Number);
  return new Date(y, mo - 1, d).getDay();
}

/** O profissional tem alguma janela de trabalho neste dia da semana? */
export function worksOnWeekday(
  windows: ScheduleWindow[] | undefined,
  weekday: number,
): boolean {
  return (windows ?? []).some((w) => w.weekday === weekday);
}

/**
 * Os inícios de atendimento (em minutos do dia) que cabem nas janelas do dia,
 * ordenados e sem repetição — janelas sobrepostas não geram slot duplicado.
 */
export function slotMinutesOfDay(
  windows: ScheduleWindow[] | undefined,
  weekday: number,
): number[] {
  const minutes = new Set<number>();
  for (const w of windows ?? []) {
    if (w.weekday !== weekday) continue;
    const start = timeToMinutes(w.start_time);
    const end = timeToMinutes(w.end_time);
    for (let m = start; m + SLOT_MINUTES <= end; m += SLOT_MINUTES)
      minutes.add(m);
  }
  return [...minutes].sort((a, b) => a - b);
}

/**
 * Dia da semana e hora de um instante no fuso do petshop. O servidor roda em
 * UTC, então `getDay()`/`getHours()` diriam outro dia — e o expediente do
 * colaborador é sempre horário local.
 */
function brazilParts(iso: string): { weekday: number; minutes: number } | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    value("weekday"),
  );
  if (weekday < 0) return null;
  // "24" aparece à meia-noite em algumas implementações de hour12: false.
  const hour = Number(value("hour")) % 24;
  return { weekday, minutes: hour * 60 + Number(value("minute")) };
}

/**
 * O instante cai dentro do expediente do profissional? Usado pelas server
 * actions antes de gravar (a UI já filtra, mas o formulário é adulterável).
 *
 * Profissional sem nenhuma janela cadastrada não é barrado: significa que o
 * petshop ainda não definiu o expediente dele, não que ele nunca atende — a
 * mesma regra do trigger em 0054.
 */
export function isWithinSchedule(
  windows: ScheduleWindow[] | undefined,
  iso: string,
): boolean {
  const list = windows ?? [];
  if (list.length === 0) return true;
  const at = brazilParts(iso);
  if (!at) return false;
  return list.some(
    (w) =>
      w.weekday === at.weekday &&
      at.minutes >= timeToMinutes(w.start_time) &&
      at.minutes < timeToMinutes(w.end_time),
  );
}
