import type { AppointmentStatus } from "@mylivepet/types";

// Colunas das gravações — reutilizadas no render inicial (server) e no refetch
// em tempo real (client), garantindo o mesmo shape nos dois lados.
export const RECORDING_SELECT =
  "id, created_at, started_at, duration_sec, camera_id, retain_until, appointment_id, appointment:appointment_id(status, pet:pet_id(name), service_type(name)), camera:camera_id(room_label)";

/**
 * Teto de linhas por consulta. A lista agrupa por atendimento, então o limite
 * não pode ser o número de cards: 30 gravações podem ser 4 atendimentos, e o
 * mais antigo viria pela metade. Buscamos um lote generoso e `groupRecordings`
 * descarta o grupo que pode ter sido cortado.
 */
export const RECORDING_FETCH_LIMIT = 200;

/** Atendimentos exibidos na lista. */
export const RECORDING_GROUP_LIMIT = 10;

type RawRecording = {
  id: string;
  created_at: string;
  started_at: string | null;
  duration_sec: number | null;
  camera_id: string | null;
  retain_until: string | null;
  appointment_id: string;
  appointment: {
    status: AppointmentStatus;
    pet: { name: string } | null;
    service_type: { name: string } | null;
  } | null;
  // Nulo enquanto o tutor não tiver policy de leitura em `camera` — o rótulo
  // então cai em "Sala 1", "Sala 2" pela ordem em que as salas aparecem.
  camera: { room_label: string | null } | null;
};

export type RecordingPart = {
  id: string;
  /** Início real da filmagem; cai no upload quando o gateway não soube dizer. */
  startedAt: string;
  durationSec: number | null;
  cameraId: string | null;
};

export type RecordingRoom = {
  /** camera_id, ou "" para as gravações sem câmera identificada. */
  key: string;
  label: string;
  parts: RecordingPart[];
};

export type RecordingGroup = {
  appointmentId: string;
  petName: string;
  serviceName: string;
  /** Atendimento em andamento: ainda vão chegar partes. */
  inProgress: boolean;
  startedAt: string;
  /** A primeira parte a expirar — é ela que some da lista primeiro. */
  retainUntil: string | null;
  /** Todas as partes em ordem cronológica; é a ordem que o player toca. */
  parts: RecordingPart[];
  /** Só preenchido quando o pet passou por mais de uma sala. */
  rooms: RecordingRoom[] | null;
  totalDurationSec: number;
};

function time(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * Agrupa as gravações por atendimento: cada uma vira um card só, com as partes
 * em ordem. O gateway grava em segmentos de 10 min (`recordSegmentDuration`) e
 * a troca de sala fecha o segmento em curso, então um banho e tosa de 1h chega
 * aqui como ~7 linhas — que o tutor não tem por que ver soltas.
 */
export function groupRecordings(data: unknown): RecordingGroup[] {
  const rows = (data ?? []) as RawRecording[];
  // Veio o lote cheio: o atendimento mais antigo pode ter ficado sem as
  // primeiras partes. Melhor omiti-lo que mostrar uma gravação incompleta.
  const truncated = rows.length >= RECORDING_FETCH_LIMIT;

  const byAppointment = new Map<string, RawRecording[]>();
  for (const row of rows) {
    const list = byAppointment.get(row.appointment_id);
    if (list) list.push(row);
    else byAppointment.set(row.appointment_id, [row]);
  }

  const groups: RecordingGroup[] = [];

  for (const [appointmentId, raw] of byAppointment) {
    const parts: RecordingPart[] = raw
      .map((r) => ({
        id: r.id,
        startedAt: r.started_at ?? r.created_at,
        durationSec: r.duration_sec,
        cameraId: r.camera_id,
      }))
      // Por started_at, não por created_at: um upload que falhou e foi
      // retentado sobe depois, mas foi filmado antes.
      .sort((a, b) => time(a.startedAt) - time(b.startedAt));
    if (parts.length === 0) continue;

    const appointment = raw.find((r) => r.appointment)?.appointment ?? null;

    // Nome real da sala quando a RLS deixa; senão numeramos pela ordem.
    const realLabels = new Map<string, string>();
    for (const r of raw) {
      if (r.camera_id && r.camera?.room_label) realLabels.set(r.camera_id, r.camera.room_label);
    }
    const seen: string[] = [];
    for (const p of parts) {
      const key = p.cameraId ?? "";
      if (key && !seen.includes(key)) seen.push(key);
    }
    const labelFor = (key: string) => {
      if (!key) return "Sala não identificada";
      return realLabels.get(key) ?? `Sala ${seen.indexOf(key) + 1}`;
    };

    // Blocos contíguos, não um grupo por câmera: se o pet volta para a sala de
    // banho depois da tosa, isso é uma terceira passagem na linha do tempo.
    const blocks: RecordingRoom[] = [];
    for (const part of parts) {
      const key = part.cameraId ?? "";
      const last = blocks[blocks.length - 1];
      if (last && last.key === key) last.parts.push(part);
      else blocks.push({ key, label: labelFor(key), parts: [part] });
    }

    const retainDates = raw
      .map((r) => r.retain_until)
      .filter((v): v is string => v !== null)
      .sort((a, b) => time(a) - time(b));

    groups.push({
      appointmentId,
      petName: appointment?.pet?.name ?? "Seu pet",
      serviceName: appointment?.service_type?.name ?? "Atendimento",
      inProgress: appointment?.status === "IN_PROGRESS",
      startedAt: parts[0].startedAt,
      retainUntil: retainDates[0] ?? null,
      parts,
      rooms: blocks.length > 1 ? blocks : null,
      totalDurationSec: parts.reduce((sum, p) => sum + (p.durationSec ?? 0), 0),
    });
  }

  groups.sort((a, b) => time(b.startedAt) - time(a.startedAt));
  if (truncated && groups.length > 1) groups.pop();
  return groups.slice(0, RECORDING_GROUP_LIMIT);
}
