import type { BehaviorCategory, BehaviorResponse } from "./dto";

// Boletim de comportamento do pet: cálculo da nota, selo de bonificação e
// agregação mensal. Módulo puro (sem React, sem I/O) compartilhado pelos dois
// apps — mesmo papel de finance.ts.
//
// A normalização de categorias invertidas acontece aqui, na escrita: o
// `overall_score` gravado no banco já sai comparável, então nem o SQL nem a view
// `pet_behavior_summary` precisam saber da inversão.

/** Nota comparável (1 = pior, 5 = melhor) mesmo em categoria invertida. */
export function normalizeBehaviorScore(
  r: Pick<BehaviorResponse, "value" | "inverted">,
): number {
  return r.inverted ? 6 - r.value : r.value;
}

/** Média 1..5 das notas normalizadas; null quando não há notas. */
export function computeOverallScore(
  responses: BehaviorResponse[],
): number | null {
  if (responses.length === 0) return null;
  const sum = responses.reduce((acc, r) => acc + normalizeBehaviorScore(r), 0);
  return Math.round((sum / responses.length) * 100) / 100;
}

// --- Selo de bonificação por bom comportamento ---

export const BEHAVIOR_BADGES = [
  "EM_TREINAMENTO",
  "BOM",
  "OTIMO",
  "EXEMPLAR",
] as const;
export type BehaviorBadge = (typeof BEHAVIOR_BADGES)[number];

export const BEHAVIOR_BADGE_LABEL: Record<BehaviorBadge, string> = {
  EM_TREINAMENTO: "Em treinamento",
  BOM: "Bom comportamento",
  OTIMO: "Ótimo comportamento",
  EXEMPLAR: "Pet exemplar",
};

/** Tone do StatusChip/Badge de @mylivepet/ui para cada selo. */
export const BEHAVIOR_BADGE_TONE: Record<
  BehaviorBadge,
  "neutral" | "info" | "brand" | "success"
> = {
  EM_TREINAMENTO: "neutral",
  BOM: "info",
  OTIMO: "brand",
  EXEMPLAR: "success",
};

/** Avaliações mínimas para o selo valer — uma nota isolada não vira "exemplar". */
export const BEHAVIOR_MIN_REPORTS = 3;

/** Faixas de média → selo. null enquanto faltam avaliações. */
export function behaviorBadgeOf(
  average: number | null,
  count: number,
): BehaviorBadge | null {
  if (average === null || count < BEHAVIOR_MIN_REPORTS) return null;
  if (average >= 4.5) return "EXEMPLAR";
  if (average >= 3.8) return "OTIMO";
  if (average >= 3.0) return "BOM";
  return "EM_TREINAMENTO";
}

/** Média formatada em pt-BR com uma casa ("4,3"). */
export function formatBehaviorScore(average: number | null): string | null {
  if (average === null || !Number.isFinite(average)) return null;
  return average.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** Categorias sugeridas — semeadas pelo botão "Usar categorias sugeridas". */
export const DEFAULT_BEHAVIOR_CATEGORIES: BehaviorCategory[] = [
  {
    id: "default-socializacao",
    label: "Socialização",
    inverted: false,
    required: true,
  },
  {
    id: "default-obediencia",
    label: "Obediência",
    inverted: false,
    required: true,
  },
  {
    id: "default-tranquilidade",
    label: "Tranquilidade no banho",
    inverted: false,
    required: true,
  },
  {
    id: "default-manuseio",
    label: "Tolerância ao manuseio",
    inverted: false,
    required: false,
  },
  {
    id: "default-ansiedade",
    label: "Ansiedade",
    inverted: true,
    required: false,
  },
];

// --- DTOs de leitura (camelCase), compartilhados pelos dois apps ---

export type BehaviorReportRow = {
  id: string;
  petId: string;
  appointmentId: string | null;
  overallScore: number | null;
  responses: BehaviorResponse[];
  note: string | null;
  createdAt: string;
  serviceName: string | null;
};

export type BehaviorSummary = {
  petId: string;
  reportCount: number;
  averageScore: number | null;
  lastReportAt: string | null;
};

export type BehaviorCategoryStat = {
  id: string;
  label: string;
  inverted: boolean;
  /** Média já normalizada (1 = pior, 5 = melhor). */
  average: number;
  count: number;
};

export type BehaviorMonth = {
  /** "2026-07" — chave estável para keys de lista. */
  key: string;
  /** "Julho de 2026" */
  label: string;
  average: number | null;
  count: number;
  categories: BehaviorCategoryStat[];
  reports: BehaviorReportRow[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

/** "Julho de 2026" — Intl devolve "julho de 2026" em pt-BR. */
function monthLabel(date: Date): string {
  const raw = MONTH_FORMATTER.format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Agrupa os boletins por mês (mais recente primeiro), com média do mês e média
 * por categoria. Usa a data local (getFullYear/getMonth, nunca UTC) para o mês
 * não "virar" perto da meia-noite.
 */
export function groupBehaviorByMonth(
  reports: BehaviorReportRow[],
): BehaviorMonth[] {
  const buckets = new Map<string, { date: Date; reports: BehaviorReportRow[] }>();

  for (const report of reports) {
    const date = new Date(report.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.reports.push(report);
    else buckets.set(key, { date, reports: [report] });
  }

  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, bucket]) => {
      const scored = bucket.reports.filter((r) => r.overallScore !== null);
      const average =
        scored.length > 0
          ? Math.round(
              (scored.reduce((acc, r) => acc + (r.overallScore ?? 0), 0) /
                scored.length) *
                100,
            ) / 100
          : null;

      return {
        key,
        label: monthLabel(bucket.date),
        average,
        count: scored.length,
        categories: aggregateCategories(bucket.reports),
        reports: [...bucket.reports].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      };
    });
}

/**
 * Média por categoria a partir do snapshot de cada resposta. O rótulo exibido é
 * o do boletim mais recente — se o petshop renomeou a categoria, vale o nome novo.
 */
export function aggregateCategories(
  reports: BehaviorReportRow[],
): BehaviorCategoryStat[] {
  const byId = new Map<
    string,
    { label: string; inverted: boolean; sum: number; count: number; at: string }
  >();

  for (const report of reports) {
    for (const response of report.responses) {
      const current = byId.get(response.category_id);
      const normalized = normalizeBehaviorScore(response);
      if (!current) {
        byId.set(response.category_id, {
          label: response.label,
          inverted: response.inverted,
          sum: normalized,
          count: 1,
          at: report.createdAt,
        });
        continue;
      }
      current.sum += normalized;
      current.count += 1;
      if (report.createdAt > current.at) {
        current.label = response.label;
        current.inverted = response.inverted;
        current.at = report.createdAt;
      }
    }
  }

  return [...byId.entries()].map(([id, c]) => ({
    id,
    label: c.label,
    inverted: c.inverted,
    average: Math.round((c.sum / c.count) * 100) / 100,
    count: c.count,
  }));
}
