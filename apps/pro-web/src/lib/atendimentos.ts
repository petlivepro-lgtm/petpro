import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import type { AppointmentStatus } from "@mylivepet/types";

// Colunas da tela de Atendimentos — reutilizadas no render inicial (server) e no
// refetch em tempo real (client), garantindo o mesmo shape nos dois lados.
export const ATENDIMENTO_SELECT =
  "id, status, origin, scheduled_at, started_at, finished_at, pet(id, name, photo_path), tutor(full_name), service_type(name, price_cents), collaborator(id, full_name)";

type RawAtendimento = {
  id: string;
  status: AppointmentStatus;
  origin: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  pet: { id: string; name: string; photo_path: string | null } | null;
  tutor: { full_name: string } | null;
  service_type: { name: string; price_cents: number } | null;
  collaborator: { id: string; full_name: string } | null;
};

export type AtendimentoRow = {
  id: string;
  status: AppointmentStatus;
  origin: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  petId: string | null;
  petName: string;
  petPhoto: string | null;
  tutorName: string | null;
  serviceName: string;
  /** Preço do serviço, para prever o líquido ao finalizar (0036). */
  servicePriceCents: number | null;
  collaboratorId: string | null;
  collaboratorName: string | null;
};

export function mapAtendimentos(rows: RawAtendimento[]): AtendimentoRow[] {
  return rows.map((a) => ({
    id: a.id,
    status: a.status,
    origin: a.origin,
    scheduledAt: a.scheduled_at,
    startedAt: a.started_at,
    finishedAt: a.finished_at,
    petId: a.pet?.id ?? null,
    petName: a.pet?.name ?? "Pet",
    petPhoto: a.pet?.photo_path ?? null,
    tutorName: a.tutor?.full_name ?? null,
    serviceName: a.service_type?.name ?? "Serviço",
    servicePriceCents: a.service_type?.price_cents ?? null,
    collaboratorId: a.collaborator?.id ?? null,
    collaboratorName: a.collaborator?.full_name ?? null,
  }));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-07-22" para a data local (sem passar por UTC, que viraria o dia). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Início do dia local em ISO — limite das consultas de agenda x histórico. */
export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export type FetchAtendimentosOptions = {
  historyFrom?: string;
  historyTo?: string;
};

/**
 * Carrega a tela inteira em duas consultas: a agenda (de hoje em diante, ordem
 * crescente) e o histórico (antes de hoje, mais recente primeiro). Atendimentos
 * em andamento entram na agenda mesmo se agendados para um dia anterior.
 */
export async function fetchAtendimentos(
  supabase: SupabaseClient<Database>,
  options: FetchAtendimentosOptions = {},
): Promise<AtendimentoRow[]> {
  const fromIso = startOfTodayIso();
  const hasHistoryPeriod = Boolean(options.historyFrom || options.historyTo);
  let historicoPeriodoQuery = supabase
    .from("appointment")
    .select(ATENDIMENTO_SELECT)
    .lt("scheduled_at", fromIso);

  if (options.historyFrom) {
    historicoPeriodoQuery = historicoPeriodoQuery.gte(
      "scheduled_at",
      options.historyFrom,
    );
  }
  if (options.historyTo) {
    historicoPeriodoQuery = historicoPeriodoQuery.lte(
      "scheduled_at",
      `${options.historyTo}T23:59:59.999`,
    );
  }

  const [agenda, andamento, historico, historicoPeriodo] = await Promise.all([
    supabase
      .from("appointment")
      .select(ATENDIMENTO_SELECT)
      .gte("scheduled_at", fromIso)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("appointment")
      .select(ATENDIMENTO_SELECT)
      .eq("status", "IN_PROGRESS"),
    supabase
      .from("appointment")
      .select(ATENDIMENTO_SELECT)
      .lt("scheduled_at", fromIso)
      .order("scheduled_at", { ascending: false })
      .limit(100),
    hasHistoryPeriod
      ? historicoPeriodoQuery
          .order("scheduled_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  // Sem data definida não casa nem `gte` nem `lt` — busca à parte para não sumir.
  const { data: semData } = await supabase
    .from("appointment")
    .select(ATENDIMENTO_SELECT)
    .is("scheduled_at", null)
    .in("status", ["REQUESTED", "CONFIRMED", "CHECKED_IN"]);

  const all = [
    ...(agenda.data ?? []),
    ...(andamento.data ?? []),
    ...(historico.data ?? []),
    ...(historicoPeriodo.data ?? []),
    ...(semData ?? []),
  ] as unknown as RawAtendimento[];

  // União por id (um atendimento IN_PROGRESS pode vir em duas consultas).
  const byId = new Map<string, RawAtendimento>();
  for (const row of all) byId.set(row.id, row);

  return mapAtendimentos([...byId.values()]);
}

// ---- Abas ------------------------------------------------------------------

export type Bucket = "hoje" | "proximos" | "historico";

export const BUCKET_LABEL: Record<Bucket, string> = {
  hoje: "Hoje",
  proximos: "Próximos",
  historico: "Histórico",
};

export function isBucket(v: string | undefined): v is Bucket {
  return v === "hoje" || v === "proximos" || v === "historico";
}

const ACTIVE_STATUSES: AppointmentStatus[] = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
];

/**
 * Hoje: agendado para o dia corrente ou em andamento (não some se atrasou).
 * Próximos: futuro (ou sem data) e ainda ativo. Histórico: o resto.
 */
export function bucketOf(row: AtendimentoRow, todayKey: string): Bucket {
  if (row.status === "IN_PROGRESS") return "hoje";
  if (!row.scheduledAt) {
    return ACTIVE_STATUSES.includes(row.status) ? "proximos" : "historico";
  }
  const key = dayKey(new Date(row.scheduledAt));
  if (key === todayKey) return "hoje";
  if (key > todayKey)
    return ACTIVE_STATUSES.includes(row.status) ? "proximos" : "historico";
  return "historico";
}

// ---- Agrupamento por dia ---------------------------------------------------

export type DayGroup = { key: string; label: string; rows: AtendimentoRow[] };

const NO_DATE = "sem-data";

function dayLabel(key: string, todayKey: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y!, m! - 1, d!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (key === todayKey) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "long" });
  return `${weekday[0]!.toUpperCase()}${weekday.slice(1)}, ${pad(d!)}/${pad(m!)}`;
}

/**
 * Agrupa por dia e ordena por data/hora. `order` vale para os grupos e para as
 * linhas dentro deles; o grupo "Sem data definida" fica sempre no topo.
 */
export function groupByDay(
  rows: AtendimentoRow[],
  order: "asc" | "desc",
  todayKey: string,
): DayGroup[] {
  const groups = new Map<string, AtendimentoRow[]>();
  for (const row of rows) {
    const key = row.scheduledAt ? dayKey(new Date(row.scheduledAt)) : NO_DATE;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const dir = order === "asc" ? 1 : -1;
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === NO_DATE) return -1;
      if (b === NO_DATE) return 1;
      return a < b ? -dir : a > b ? dir : 0;
    })
    .map(([key, list]) => ({
      key,
      label: key === NO_DATE ? "Sem data definida" : dayLabel(key, todayKey),
      rows: list.sort((x, y) => {
        const a = x.scheduledAt ?? "";
        const b = y.scheduledAt ?? "";
        return a < b ? -dir : a > b ? dir : 0;
      }),
    }));
}

// ---- Formatação ------------------------------------------------------------

/** "2026-07-22T09:00:00Z" → "09:00"; sem data → "--:--". */
export function formatTime(v: string | null): string {
  if (!v) return "--:--";
  return new Date(v).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(v: string | null): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
