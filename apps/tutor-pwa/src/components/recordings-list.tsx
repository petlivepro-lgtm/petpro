"use client";

import { useState, useTransition } from "react";
import { Film, PlayCircle } from "lucide-react";
import { Card } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { getRecordingUrl } from "@/app/(app)/ao-vivo/actions";

export type RecordingRow = {
  id: string;
  created_at: string;
  retain_until: string | null;
  duration_sec: number | null;
  petName: string;
  serviceName: string;
};

function fmtDate(v: string) {
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDuration(sec: number | null) {
  if (!sec) return null;
  const m = Math.round(sec / 60);
  return m < 1 ? "menos de 1 min" : `${m} min`;
}

function expiresIn(retainUntil: string | null): string | null {
  if (!retainUntil) return null;
  const days = Math.ceil((new Date(retainUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return null;
  return days === 1 ? "expira amanhã" : `expira em ${days} dias`;
}

async function fetchRecordings(): Promise<RecordingRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("recording")
    .select(
      "id, created_at, retain_until, duration_sec, appointment:appointment_id(pet:pet_id(name), service_type(name))",
    )
    .gt("retain_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r) => {
    const appt = r.appointment as unknown as {
      pet: { name: string } | null;
      service_type: { name: string } | null;
    } | null;
    return {
      id: r.id,
      created_at: r.created_at,
      retain_until: r.retain_until,
      duration_sec: r.duration_sec,
      petName: appt?.pet?.name ?? "Seu pet",
      serviceName: appt?.service_type?.name ?? "Atendimento",
    };
  });
}

/** Gravações dos atendimentos do tutor, até expirarem (retenção do petshop). */
export function RecordingsList({ initial }: { initial: RecordingRow[] }) {
  const rows = useRealtimeList<RecordingRow>(
    initial,
    fetchRecordings,
    [{ table: "recording" }],
    "live:recordings",
  );
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-graphite">
        <Film className="h-4 w-4 text-orange" /> Gravações
      </h2>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        {rows.map((r) => {
          const expiry = expiresIn(r.retain_until);
          const duration = fmtDuration(r.duration_sec);
          const isPlaying = playing?.id === r.id;
          return (
            <Card key={r.id} className="space-y-3">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  startLoading(async () => {
                    setError(null);
                    if (isPlaying) return setPlaying(null);
                    const result = await getRecordingUrl(r.id);
                    if (result.url) setPlaying({ id: r.id, url: result.url });
                    else setError(result.error ?? "Não foi possível abrir a gravação");
                  })
                }
                className="flex w-full items-center gap-3 text-left"
              >
                <PlayCircle className="h-8 w-8 shrink-0 text-orange" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-graphite">
                    {r.petName} · {r.serviceName}
                  </p>
                  <p className="text-xs text-gray-neutral">
                    {fmtDate(r.created_at)}
                    {duration ? ` · ${duration}` : ""}
                    {expiry ? ` · ${expiry}` : ""}
                  </p>
                </div>
              </button>
              {isPlaying && (
                <video
                  src={playing.url}
                  controls
                  autoPlay
                  playsInline
                  className="aspect-video w-full rounded-xl bg-graphite object-contain"
                />
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
