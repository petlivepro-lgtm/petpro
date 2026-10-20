import type { AppointmentStatus } from "@mylivepet/types";

// Leitura e formatação da tela Início.
//
// As datas saem sempre no fuso de São Paulo: a página renderiza no servidor,
// que roda em UTC — sem o timeZone explícito o "Bom dia" e o horário do
// próximo banho sairiam três horas adiantados.
//
// String literal única (sem concatenação com +), como o supabase-js exige.

/** Atendimentos em aberto: o que está acontecendo agora e o que vem por aí. */
export const HOME_OPEN_SELECT = `id, status, scheduled_at, started_at, camera_id, request_group_id,
  pet:pet_id(id, name, photo_path), service_type(name), appointment_step(label, done_at, position)`;

/** Concluídos recentes, para lembrar o tutor de avaliar. */
export const HOME_REVIEW_SELECT = `id, finished_at, scheduled_at, request_group_id,
  pet:pet_id(id, name, photo_path), service_type(name), feedback(direction)`;

/** Janela em que um atendimento concluído ainda pede avaliação na home. */
export const REVIEW_WINDOW_DAYS = 30;

const TZ = "America/Sao_Paulo";

export type HomePet = { id: string; name: string; photo_path: string | null };

export type RawOpenAppointment = {
  id: string;
  status: AppointmentStatus;
  scheduled_at: string | null;
  started_at: string | null;
  camera_id: string | null;
  request_group_id: string | null;
  pet: HomePet | null;
  service_type: { name: string } | null;
  appointment_step: { label: string; done_at: string | null; position: number }[] | null;
};

export type RawReviewAppointment = {
  id: string;
  finished_at: string | null;
  scheduled_at: string | null;
  request_group_id: string | null;
  pet: HomePet | null;
  service_type: { name: string } | null;
  feedback: { direction: string }[] | null;
};

/** Um horário na visão do tutor: os serviços do mesmo pedido viram uma linha só. */
export type HomeVisit = {
  id: string;
  status: AppointmentStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  hasCamera: boolean;
  pet: HomePet;
  services: string[];
  steps: { label: string; done: boolean }[];
  /** Quantos atendimentos o pedido tem — o card fala "+1 serviço" etc. */
  ids: string[];
};

export type ReviewReminder = {
  id: string;
  pet: HomePet;
  serviceName: string;
  finishedAt: string | null;
};

function groupKey(a: { id: string; request_group_id: string | null; scheduled_at: string | null }) {
  return a.request_group_id ? `${a.request_group_id}|${a.scheduled_at ?? ""}` : a.id;
}

/**
 * Agrupa os atendimentos em aberto por pedido (mesmo request_group_id e mesmo
 * horário). O status do grupo é o mais adiantado entre os serviços — se o
 * banho já começou, o pedido inteiro está "em andamento" para o tutor.
 */
export function groupOpenAppointments(rows: RawOpenAppointment[]): HomeVisit[] {
  const rank: Partial<Record<AppointmentStatus, number>> = {
    REQUESTED: 0,
    CONFIRMED: 1,
    CHECKED_IN: 2,
    IN_PROGRESS: 3,
  };
  const groups = new Map<string, HomeVisit>();

  for (const row of rows) {
    if (!row.pet) continue;
    const key = groupKey(row);
    const service = row.service_type?.name ?? "Serviço";
    const steps = (row.appointment_step ?? [])
      .slice()
      .sort((x, y) => x.position - y.position)
      .map((s) => ({ label: s.label, done: s.done_at !== null }));
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        id: row.id,
        status: row.status,
        scheduledAt: row.scheduled_at,
        startedAt: row.started_at,
        hasCamera: row.status === "IN_PROGRESS" && row.camera_id !== null,
        pet: row.pet,
        services: [service],
        steps,
        ids: [row.id],
      });
      continue;
    }

    current.services.push(service);
    current.ids.push(row.id);
    if ((rank[row.status] ?? 0) > (rank[current.status] ?? 0)) {
      // O serviço que está acontecendo agora passa a representar o pedido.
      current.id = row.id;
      current.status = row.status;
      current.startedAt = row.started_at;
      current.steps = steps;
    }
    if (row.status === "IN_PROGRESS" && row.camera_id !== null) current.hasCamera = true;
  }

  return [...groups.values()];
}

/** Concluídos sem a avaliação do tutor, um por pedido, do mais recente ao mais antigo. */
export function pendingReviews(rows: RawReviewAppointment[]): ReviewReminder[] {
  const seen = new Set<string>();
  const result: ReviewReminder[] = [];
  for (const row of rows) {
    if (!row.pet) continue;
    const reviewed = (row.feedback ?? []).some((f) => f.direction === "TUTOR_TO_PETSHOP");
    if (reviewed) continue;
    const key = groupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      id: row.id,
      pet: row.pet,
      serviceName: row.service_type?.name ?? "atendimento",
      finishedAt: row.finished_at ?? row.scheduled_at,
    });
  }
  return result;
}

/** Link que abre o card do atendimento já expandido no histórico. */
export function appointmentHref(petId: string, appointmentId: string) {
  return `/atendimentos?pet=${petId}&abrir=${appointmentId}#atendimento-${appointmentId}`;
}

// --- datas no fuso de São Paulo ---

function parts(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, ...options }).formatToParts(date);
}

function part(list: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return list.find((p) => p.type === type)?.value ?? "";
}

/** YYYY-MM-DD do dia em São Paulo. */
export function dayKey(date: Date): string {
  const p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${part(p, "year")}-${part(p, "month")}-${part(p, "day")}`;
}

/** Meia-noite de hoje em São Paulo, em ISO (o Brasil não tem horário de verão desde 2019). */
export function startOfTodayIso(): string {
  return new Date(`${dayKey(new Date())}T00:00:00-03:00`).toISOString();
}

export function greeting(now = new Date()): string {
  const hour = Number(part(parts(now, { hour: "2-digit", hourCycle: "h23" }), "hour"));
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "terça-feira, 20 de outubro" */
export function longToday(now = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

export function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** "20/10" */
export function shortDay(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(iso));
}

/** Peças do bloco de data: dia do mês, mês e dia da semana abreviados. */
export function dateTile(iso: string) {
  const date = new Date(iso);
  const p = parts(date, { day: "2-digit", month: "short", weekday: "short" });
  const clean = (s: string) => s.replace(".", "");
  return {
    day: part(p, "day"),
    month: clean(part(p, "month")),
    weekday: clean(part(p, "weekday")),
  };
}

/** "Hoje", "Amanhã", "Quinta-feira" (até 6 dias) ou "Em 12 dias". */
export function relativeDay(iso: string, now = new Date()): string {
  const diff = Math.round(
    (Date.parse(`${dayKey(new Date(iso))}T00:00:00Z`) -
      Date.parse(`${dayKey(now)}T00:00:00Z`)) /
      86_400_000,
  );
  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 7) {
    const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(
      new Date(iso),
    );
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  return `Em ${diff} dias`;
}

/** "Banho", "Banho e Hidratação", "Banho, Tosa e Hidratação" */
export function joinServices(services: string[]): string {
  if (services.length <= 1) return services[0] ?? "Serviço";
  return `${services.slice(0, -1).join(", ")} e ${services[services.length - 1]}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
