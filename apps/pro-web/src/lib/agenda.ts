import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import {
  ATENDIMENTO_SELECT,
  dayKey,
  mapAtendimentos,
  type AtendimentoRow,
} from "@/lib/atendimentos";

/** Modos da tela de agenda — o histórico em lista é o quarto. */
export type AgendaView = "dia" | "semana" | "mes" | "historico";

export function isAgendaView(v: string | undefined): v is AgendaView {
  return v === "dia" || v === "semana" || v === "mes" || v === "historico";
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

/**
 * Anda de mês em mês pelo dia 1º, e não somando 30 dias.
 *
 * Somar dias faria 31/01 + 1 mês virar 02/03, e a seta pularia fevereiro
 * inteiro. Ancorar no primeiro dia do mês é o que mantém a sequência
 * jan → fev → mar independentemente do dia que estava selecionado.
 */
export function addMonths(key: string, months: number): string {
  const d = parseDayKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

/**
 * Os dias que a grade do mês desenha: do domingo da semana do dia 1º ao
 * sábado da semana do último dia. São 35 ou 42 casas, e as das pontas caem
 * nos meses vizinhos — sem elas a primeira e a última semana ficariam
 * quebradas ao meio.
 */
export function monthGridDays(key: string): string[] {
  const d = parseDayKey(key);
  const first = dayKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const last = dayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  const start = weekStart(first);
  const end = addDays(weekStart(last), 6);

  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

/** O dia pertence ao mês de referência, ou é sobra da semana vizinha? */
export function isSameMonth(key: string, reference: string): boolean {
  const a = parseDayKey(key);
  const b = parseDayKey(reference);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** "Agosto de 2026" — o rótulo da barra de navegação no modo mês. */
export function formatMonthHeading(key: string): string {
  const label = parseDayKey(key).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  return label[0]!.toUpperCase() + label.slice(1);
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

/** Janela de dias que o modo pede: um dia, os sete da semana ou a grade do mês. */
export function agendaRange(
  view: AgendaView,
  date: string,
): { from: string; to: string } {
  if (view === "semana") {
    const days = weekDays(date);
    return { from: days[0]!, to: days[6]! };
  }
  if (view === "mes") {
    const days = monthGridDays(date);
    return { from: days[0]!, to: days[days.length - 1]! };
  }
  return { from: date, to: date };
}

// ---- Faixas de horário -----------------------------------------------------

export type CollaboratorWindow = {
  collaborator_id: string;
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

/** A coluna de quem ainda não tem profissional definido. */
export const NO_COLLABORATOR = "none";

/**
 * A célula da grade: a linha é sempre a faixa de uma hora; a coluna é o dia
 * na visão de Semana e o profissional na de Dia.
 */
export function cellKey(column: string, hour: number): string {
  return `${column}|${hour}`;
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
    const column =
      mode === "semana"
        ? dayKey(at)
        : (row.collaboratorId ?? NO_COLLABORATOR);
    const key = cellKey(column, hour);
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  // Dentro da célula, a ordem é a do relógio. A consulta já vem ordenada, mas a
  // atualização em tempo real insere fora de ordem — e numa célula com vários
  // atendimentos empilhados isso salta aos olhos.
  for (const list of map.values()) {
    list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }
  return map;
}

/** Um profissional, do jeito que a grade e o filtro precisam dele. */
export type AgendaCollaborator = {
  id: string;
  full_name: string;
  role_title?: string | null;
};

/** Uma coluna da visão de Dia. */
export type DayColumn = {
  /** Id do profissional, ou `NO_COLLABORATOR`. */
  id: string;
  name: string;
  roleTitle: string | null;
};

/**
 * As colunas da visão de Dia: os profissionais, e não as horas — que já são as
 * linhas. Repetir a hora nos dois eixos deixava a grade legível só na diagonal.
 *
 * Entra quem tem expediente naquele dia da semana; quem tem atendimento entra
 * junto mesmo fora do expediente, pela mesma razão de `hourBands` — um encaixe
 * nunca pode sumir da tela. Sem nenhum expediente cadastrado, mostra todo mundo
 * que está ativo, senão a agenda abriria vazia.
 *
 * A coluna "Sem profissional" só aparece quando há atendimento sem responsável:
 * fora isso ela seria uma faixa morta, já que agendar exige escolher alguém.
 */
export function dayColumns(
  collaborators: AgendaCollaborator[],
  windows: CollaboratorWindow[],
  rows: AtendimentoRow[],
  date: string,
): DayColumn[] {
  const weekday = parseDayKey(date).getDay();
  const working = new Set(
    windows.filter((w) => w.weekday === weekday).map((w) => w.collaborator_id),
  );
  const busy = new Set(
    rows.map((r) => r.collaboratorId).filter((id): id is string => id != null),
  );

  const columns: DayColumn[] = collaborators
    .filter((c) => working.size === 0 || working.has(c.id) || busy.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.full_name,
      roleTitle: c.role_title ?? null,
    }));

  // Um atendimento de profissional inativo (ou fora da lista visível) ainda
  // precisa de onde cair — o nome vem do próprio atendimento.
  const known = new Set(columns.map((c) => c.id));
  for (const row of rows) {
    if (!row.collaboratorId || known.has(row.collaboratorId)) continue;
    known.add(row.collaboratorId);
    columns.push({
      id: row.collaboratorId,
      name: row.collaboratorName ?? "Profissional",
      roleTitle: null,
    });
  }

  const orphan = rows.some((r) => r.collaboratorId == null && r.scheduledAt);
  if (orphan || columns.length === 0) {
    columns.push({
      id: NO_COLLABORATOR,
      name: "Sem profissional",
      roleTitle: null,
    });
  }

  return columns;
}

/**
 * Indexa os atendimentos por DIA, para a grade do mês.
 *
 * Separado de `byCell` de propósito: lá a chave é dia|hora, porque a célula é
 * uma faixa de uma hora. Aqui a célula é o dia inteiro, e estender aquela
 * função para os dois formatos só acrescentaria um ramo em código que Dia e
 * Semana já usam bem.
 */
export function byDay(rows: AtendimentoRow[]): Map<string, AtendimentoRow[]> {
  const map = new Map<string, AtendimentoRow[]>();
  for (const row of rows) {
    if (!row.scheduledAt) continue;
    const key = dayKey(new Date(row.scheduledAt));
    const list = map.get(key);
    if (list) list.push(row);
    else map.set(key, [row]);
  }
  // Dentro do dia, a ordem é a do relógio — a consulta já vem ordenada, mas a
  // atualização em tempo real pode inserir uma linha fora de ordem.
  for (const list of map.values()) {
    list.sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  }
  return map;
}

/** "2026-05-18" + hora cheia → "2026-05-18T09:00", o que o DatePicker fala. */
export function slotValue(day: string, hour: number): string {
  return `${day}T${pad(hour)}:00`;
}
