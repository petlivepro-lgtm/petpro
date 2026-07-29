import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BehaviorReportRow,
  BehaviorResponse,
  BehaviorSummary,
  Database,
} from "@mylivepet/types";

// Camada de leitura do boletim de comportamento do pet (espelho do módulo do
// pro-web — o tutor só lê, a RLS garante que sejam apenas os seus pets).
//
// Mora aqui, e não no componente client, porque os exports de um módulo
// "use client" viram referências de client component quando importados por um
// Server Component (a constante chegaria como proxy, não como string).
//
// String literal única (sem concatenação com +): é o que permite ao supabase-js
// inferir o tipo das linhas a partir do select.
export const BEHAVIOR_REPORT_SELECT = `id, pet_id, appointment_id, overall_score, responses, note, created_at,
  appointment:appointment_id(service_type(name))`;

export type RawBehaviorReport = {
  id: string;
  pet_id: string;
  appointment_id: string | null;
  // numeric volta como string no supabase-js.
  overall_score: number | string | null;
  responses: unknown;
  note: string | null;
  created_at: string;
  appointment: { service_type: { name: string } | null } | null;
};

function num(v: number | string | null): number | null {
  if (v === null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

export function mapBehaviorReports(
  rows: RawBehaviorReport[],
): BehaviorReportRow[] {
  return rows.map((r) => ({
    id: r.id,
    petId: r.pet_id,
    appointmentId: r.appointment_id,
    overallScore: num(r.overall_score),
    responses: Array.isArray(r.responses)
      ? (r.responses as BehaviorResponse[])
      : [],
    note: r.note,
    createdAt: r.created_at,
    serviceName: r.appointment?.service_type?.name ?? null,
  }));
}

/** Boletins de um pet, do mais recente para o mais antigo. */
export async function fetchPetBehaviorReports(
  supabase: SupabaseClient<Database>,
  petId: string,
): Promise<BehaviorReportRow[]> {
  const { data } = await supabase
    .from("pet_behavior_report")
    .select(BEHAVIOR_REPORT_SELECT)
    .eq("pet_id", petId)
    .order("created_at", { ascending: false });
  return mapBehaviorReports((data ?? []) as unknown as RawBehaviorReport[]);
}

/** Média e nº de avaliações por pet, indexado por pet_id. */
export async function fetchBehaviorSummaries(
  supabase: SupabaseClient<Database>,
  petIds: string[],
): Promise<Map<string, BehaviorSummary>> {
  const result = new Map<string, BehaviorSummary>();
  if (petIds.length === 0) return result;

  const { data } = await supabase
    .from("pet_behavior_summary")
    .select("pet_id, report_count, average_score, last_report_at")
    .in("pet_id", petIds);

  for (const row of data ?? []) {
    if (!row.pet_id) continue;
    result.set(row.pet_id, {
      petId: row.pet_id,
      reportCount: row.report_count ?? 0,
      averageScore: num(row.average_score),
      lastReportAt: row.last_report_at,
    });
  }
  return result;
}
