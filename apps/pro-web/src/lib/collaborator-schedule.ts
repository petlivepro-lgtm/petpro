import { WEEKDAY_LABEL, type Weekday } from "@mylivepet/types";

/** Uma janela de trabalho como vem de collaborator_schedule (0014). */
export type ScheduleRow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

/** "08:00:00" (time do Postgres) → "08:00" */
export function hhmm(t: string): string {
  return t.slice(0, 5);
}

/** As faixas de um dia, já ordenadas: "08:00–12:00, 13:00–18:00". */
export function rangesOfDay(schedules: ScheduleRow[]): string {
  return schedules
    .slice()
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((s) => `${hhmm(s.start_time)}–${hhmm(s.end_time)}`)
    .join(", ");
}

/** Agrupa as janelas por dia da semana, de domingo a sábado. */
export function scheduleByDay(schedules: ScheduleRow[]): Map<number, ScheduleRow[]> {
  const byDay = new Map<number, ScheduleRow[]>();
  for (const s of schedules) {
    const list = byDay.get(s.weekday) ?? [];
    list.push(s);
    byDay.set(s.weekday, list);
  }
  return byDay;
}

/** Resume as janelas por dia: ["Segunda 08:00–12:00, 13:00–18:00", ...]. */
export function scheduleSummary(schedules: ScheduleRow[]): string[] {
  return [...scheduleByDay(schedules).entries()]
    .sort(([a], [b]) => a - b)
    .map(
      ([weekday, list]) => `${WEEKDAY_LABEL[weekday as Weekday]} ${rangesOfDay(list)}`,
    );
}
