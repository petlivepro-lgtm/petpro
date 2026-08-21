import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import {
  ATENDIMENTO_SELECT,
  dayKey,
  mapAtendimentos,
  type AtendimentoRow,
} from "@/lib/atendimentos";

/** Modos da tela de agenda — o histórico em lista é o terceiro. */
export type AgendaView = "dia" | "semana" | "historico";

export function isAgendaView(v: string | undefined): v is AgendaView {
  return v === "dia" || v === "semana" || v === "historico";
}

const pad = (n: number) => String(n).padStart(2, "0");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-05-18" → Date local à meia-noite (sem passar por UTC). */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function isDayKey(v: string | undefined): v is string {
  return !!v && ISO_DATE.test(v) && !Number.isNaN(parseDayKey(v).getTime());
}

export function addDays(key: string, days: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** Domingo da semana de `key` — mesma convenção de `Date.getDay()`. */
export function weekStart(key: string): string {
  const d = parseDayKey(key);
  return addDays(key, -d.getDay());
}

export function weekDays(key: string): string[] {
  const start = weekStart(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** "18/05/2025 - Domingo" — o rótulo da barra de navegação. */
export function formatDayHeading(key: string): string {
  const d = parseDayKey(key);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${
    weekday[0]!.toUpperCase() + weekday.slice(1)
  }`;
}

/** "18/05 - 24/05/2025" — o mesmo rótulo, para a semana. */
export function formatWeekHeading(key: string): string {
  const days = weekDays(key);
  const a = parseDayKey(days[0]!);
  const b = parseDayKey(days[6]!);
  return `${pad(a.getDate())}/${pad(a.getMonth() + 1)} - ${pad(
    b.getDate(),
  )}/${pad(b.getMonth() + 1)}/${b.getFullYear()}`;
}

/** "Dom", "Seg"... sem o ponto que o Intl coloca em pt-BR. */
export function shortWeekday(key: string): string {
  const raw = parseDayKey(key).toLocaleDateString("pt-BR", {
    weekday: "short",
  });
  const clean = raw.replace(".", "");
  return clean[0]!.toUpperCase() + clean.slice(1);
}

// ---- Consulta --------------------------------------------------------------

/** Intervalo local [início do dia `from`, fim do dia `to`] em ISO. */
export function rangeIso(from: string, to: string): { gte: string; lte: string } {
  const start = parseDayKey(from);
  const end = parseDayKey(to);
  end.setHours(23, 59, 59, 999);
  return { gte: start.toISOString(), lte: end.toISOString() };
}

/**
 * Os atendimentos de um intervalo de dias. Uma consulta só — a agenda em
 * calendário sempre olha uma janela fechada, ao contrário da lista antiga, que
 * precisava de "hoje em diante" e "antes de hoje" separados.
 *
 * `IN_PROGRESS` fora da janela não é trazido de propósito: na grade o card
 * precisa de um horário para ocupar uma célula, e um atendimento que atravessou
 * a virada do dia continua ancorado no dia em que foi agendado.
 */
export async function fetchAgenda(
  supabase: SupabaseClient<Database>,
  from: string,
  to: string,
): Promise<AtendimentoRow[]> {
  const { gte, lte } = rangeIso(from, to);
  const { data } = await supabase
    .from("appointment")
    .select(ATENDIMENTO_SELECT)
    .gte("scheduled_at", gte)
    .lte("scheduled_at", lte)
    .order("scheduled_at", { ascending: true });

  return mapAtendimentos(
    (data ?? []) as unknown as Parameters<typeof mapAtendimentos>[0],
  );
}

/** Janela de dias que o modo pede: um dia, ou os sete da semana. */
export function agendaRange(
  view: AgendaView,
  date: string,
): { from: string; to: string } {
  if (view === "semana") {
    const days = weekDays(date);
    return { from: days[0]!, to: days[6]! };
  }
  return { from: date, to: date };
}

// ---- Faixas de horário -----------------------------------------------------

export type CollaboratorWindow = {
  weekday: number;
  start_time: string;
  end_time: string;
};

/** Fora do expediente cadastrado, a grade ainda precisa de um dia plausível. */
const FALLBACK_BAND = { first: 8, last: 18 };

/** "09:00:00" → 9 (a hora cheia em que a janela começa). */
function hourOf(time: string): number {
  return Number(time.slice(0, 2));
}

/**
 * As horas cheias que viram linha e coluna da grade.
 *
 * Nasce do expediente dos profissionais (`collaborator_schedule`) nos dias
 * visíveis, e não de um 00h–23h fixo: é o que dá o "buraco" do almoço quando
 * ninguém trabalha ao meio-dia. Toda hora que tem atendimento entra também,
 * mesmo fora do expediente — um encaixe nunca pode sumir da tela.
 */
export function hourBands(
  windows: CollaboratorWindow[],
  days: string[],
  rows: AtendimentoRow[],
): number[] {
  const weekdays = new Set(days.map((d) => parseDayKey(d).getDay()));
  const hours = new Set<number>();

  for (const w of windows) {
    if (!weekdays.has(w.weekday)) continue;
    const start = hourOf(w.start_time);
    // Uma janela que termina às 18:00 não ocupa a faixa das 18h.
    const end = Math.ceil(
      (Number(w.end_time.slice(0, 2)) * 60 + Number(w.end_time.slice(3, 5))) /
        60,
    );
    for (let h = start; h < end; h++) hours.add(h);
  }

  for (const row of rows) {
    if (row.scheduledAt) hours.add(new Date(row.scheduledAt).getHours());
  }

  if (hours.size === 0) {
    for (let h = FALLBACK_BAND.first; h <= FALLBACK_BAND.last; h++)
      hours.add(h);
  }

  return [...hours].sort((a, b) => a - b);
}

export function hourLabel(hour: number): string {
  return `${pad(hour)}:00`;
}

/** "09:00 - 10:00" — o rótulo da coluna Horário. */
export function bandLabel(hour: number): string {
  return `${hourLabel(hour)} - ${hourLabel(hour + 1)}`;
}

/**
 * Onde cada atendimento cai na grade do dia: a faixa de horário (linha) e a
 * hora (coluna) saem as duas de `scheduled_at`, como no desenho da tela.
 */
export function cellKey(dayOrHour: string | number, hour: number): string {
  return `${dayOrHour}|${hour}`;
}

/** Indexa os atendimentos por célula, para a grade só ler o mapa. */
export function byCell(
  rows: AtendimentoRow[],
  mode: "dia" | "semana",
): Map<string, AtendimentoRow[]> {
  const map = new Map<string, AtendimentoRow[]>();
  for (const row of rows) {
    if (!row.scheduledAt) continue;
    const at = new Date(row.scheduledAt);
    const hour = at.getHours();
    const key = cellKey(mode === "semana" ? dayKey(at) : hour, hour);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  return map;
}

/** "2026-05-18" + hora cheia → "2026-05-18T09:00", o que o DatePicker fala. */
export function slotValue(day: string, hour: number): string {
  return `${day}T${pad(hour)}:00`;
}
