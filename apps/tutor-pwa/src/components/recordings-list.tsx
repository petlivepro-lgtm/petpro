"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { ChevronDown, Film, Pause, Play, Video } from "lucide-react";
import { Card } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import {
  RECORDING_FETCH_LIMIT,
  RECORDING_SELECT,
  groupRecordings,
  type RecordingGroup,
  type RecordingPart,
} from "@/lib/recordings";
import { getRecordingUrls, logRecordingView } from "@/app/(app)/ao-vivo/actions";

/**
 * Duração assumida quando o gateway não soube dizer (nome do arquivo fora do
 * padrão). Bate com o `recordSegmentDuration` do mediamtx.yml e só afeta a
 * barra de progresso — a reprodução usa a duração real do arquivo.
 */
const FALLBACK_PART_SEC = 600;

function durOf(part: RecordingPart): number {
  return part.durationSec ?? FALLBACK_PART_SEC;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtElapsed(sec: number) {
  const s = Math.max(Math.floor(sec), 0);
  const two = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h > 0 ? `${h}:${two(m)}:${two(s % 60)}` : `${m}:${two(s % 60)}`;
}

function expiresIn(retainUntil: string | null): string | null {
  if (!retainUntil) return null;
  const days = Math.ceil((new Date(retainUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return null;
  return days === 1 ? "expira amanhã" : `expira em ${days} dias`;
}

/** Resumo do card: data, janela do atendimento e quantas partes já existem. */
function summarize(group: RecordingGroup): string {
  const date = fmtDate(group.startedAt);
  const start = fmtClock(group.startedAt);
  if (group.inProgress) return `${date} · desde ${start} · gravando agora`;

  const last = group.parts[group.parts.length - 1];
  const end = fmtClock(new Date(new Date(last.startedAt).getTime() + durOf(last) * 1000).toISOString());
  const n = group.parts.length;
  return `${date} · ${start} às ${end} · ${n} ${n === 1 ? "parte" : "partes"}`;
}

async function fetchRecordings(): Promise<RecordingGroup[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("recording")
    .select(RECORDING_SELECT)
    .gt("retain_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(RECORDING_FETCH_LIMIT);
  return groupRecordings(data);
}

/**
 * Gravações dos atendimentos do tutor, um card por atendimento. As partes de
 * 10 min (e as que a troca de sala corta antes disso) tocam emendadas, como um
 * vídeo só: ao terminar uma, a seguinte — já assinada — entra no lugar.
 */
export function RecordingsList({ initial }: { initial: RecordingGroup[] }) {
  const groups = useRealtimeList<RecordingGroup>(
    initial,
    fetchRecordings,
    // `appointment` entra junto: é a mudança de status que tira o "gravando
    // agora" do card quando o petshop finaliza o atendimento.
    [{ table: "recording" }, { table: "appointment" }],
    "live:recordings",
  );

  // Estados do player vivem fora de `groups` de propósito: a lista é trocada
  // inteira a cada parte nova que sobe (a cada ~10 min, com a câmera ligada) e
  // o card aberto não pode fechar nem o vídeo voltar ao início por causa disso.
  const [openId, setOpenId] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [partTime, setPartTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const openGroup = groups.find((g) => g.appointmentId === openId) ?? null;
  const activeIndex = openGroup ? openGroup.parts.findIndex((p) => p.id === activeId) : -1;

  /** Segundos acumulados até o início da parte `index`. */
  const offsetOf = useCallback((group: RecordingGroup, index: number) => {
    let sum = 0;
    for (let i = 0; i < index; i += 1) sum += durOf(group.parts[i]);
    return sum;
  }, []);

  /** Assina a parte pedida e a seguinte, marca a atual como vista e toca. */
  const playPart = useCallback(
    (group: RecordingGroup, index: number, seekWithin = 0) => {
      const part = group.parts[index];
      if (!part) return;
      const next = group.parts[index + 1];
      const wanted = [part.id, ...(next ? [next.id] : [])];

      startLoading(async () => {
        setError(null);
        if (wanted.some((id) => !urls[id])) {
          const result = await getRecordingUrls(wanted);
          if (result.error || !result.urls?.[part.id]) {
            setError(result.error ?? "Não foi possível abrir a gravação");
            return;
          }
          setUrls((prev) => ({ ...prev, ...result.urls }));
        }
        pendingSeekRef.current = seekWithin;
        setPartTime(seekWithin);
        setActiveId(part.id);
        setPlaying(true);
        void logRecordingView(part.id).catch(() => {});
      });
    },
    [urls],
  );

  const toggleGroup = (group: RecordingGroup) => {
    if (openId === group.appointmentId) {
      setOpenId(null);
      setActiveId(null);
      setPlaying(false);
      return;
    }
    setOpenId(group.appointmentId);
    setActiveId(null);
    setPlaying(false);
    setPartTime(0);
    setError(null);
  };

  const togglePlay = () => {
    if (!openGroup) return;
    if (activeIndex < 0) return playPart(openGroup, 0);
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  /** Clique na barra: encontra em qual parte cai aquele instante e pula. */
  const seekTo = (group: RecordingGroup, seconds: number) => {
    let acc = 0;
    for (let i = 0; i < group.parts.length; i += 1) {
      const dur = durOf(group.parts[i]);
      if (seconds < acc + dur || i === group.parts.length - 1) {
        const within = Math.max(seconds - acc, 0);
        if (i === activeIndex && videoRef.current) {
          videoRef.current.currentTime = within;
          setPartTime(within);
          return;
        }
        playPart(group, i, within);
        return;
      }
      acc += dur;
    }
  };

  if (groups.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-graphite">
        <Film className="h-4 w-4 text-orange" /> Gravações
      </h2>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="space-y-3">
        {groups.map((group) => {
          const open = openId === group.appointmentId;
          const expiry = expiresIn(group.retainUntil);
          const total = group.parts.reduce((sum, p) => sum + durOf(p), 0);
          const elapsed = open && activeIndex >= 0 ? offsetOf(group, activeIndex) + partTime : 0;
          const activeRoom =
            open && activeIndex >= 0 && group.rooms
              ? (group.rooms.find((r) => r.parts.some((p) => p.id === activeId))?.label ?? null)
              : null;
          const activeUrl = activeId ? urls[activeId] : undefined;

          return (
            <Card key={group.appointmentId} className="space-y-3">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange text-white">
                  <Play className="h-4 w-4 translate-x-[1px] fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-graphite">
                    {group.petName} · {group.serviceName}
                  </span>
                  <span className="block text-xs text-gray-neutral">
                    {summarize(group)}
                    {expiry ? ` · ${expiry}` : ""}
                  </span>
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-gray-neutral transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="space-y-3">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-graphite">
                    {activeUrl ? (
                      <video
                        // A key troca só quando muda a parte: um refetch da
                        // lista não recria o elemento nem reinicia o vídeo.
                        key={activeId ?? "none"}
                        ref={videoRef}
                        src={activeUrl}
                        autoPlay
                        playsInline
                        controls
                        className="h-full w-full object-contain"
                        onLoadedMetadata={(e) => {
                          const seek = pendingSeekRef.current;
                          pendingSeekRef.current = null;
                          if (seek) e.currentTarget.currentTime = seek;
                        }}
                        onPlay={() => setPlaying(true)}
                        onPause={() => setPlaying(false)}
                        onTimeUpdate={(e) => {
                          // Quantizado em 0,5s para não re-renderizar a lista
                          // a cada quadro.
                          setPartTime(Math.floor(e.currentTarget.currentTime * 2) / 2);
                        }}
                        onEnded={() => {
                          const next = activeIndex + 1;
                          if (next < group.parts.length) playPart(group, next);
                          else setPlaying(false);
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={togglePlay}
                        aria-label="Assistir o atendimento"
                        className="flex h-full w-full items-center justify-center"
                      >
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
                          {playing ? (
                            <Pause className="h-6 w-6 text-white" />
                          ) : (
                            <Play className="h-6 w-6 translate-x-[2px] fill-white text-white" />
                          )}
                        </span>
                      </button>
                    )}

                    {activeRoom && (
                      <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange" />
                        {activeRoom}
                      </span>
                    )}
                  </div>

                  {/* Uma barra só para o atendimento inteiro: as emendas entre
                      as partes não viram assunto do tutor. */}
                  <div className="space-y-1.5">
                    <div
                      role="slider"
                      tabIndex={0}
                      aria-label="Posição no atendimento"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(total)}
                      aria-valuenow={Math.round(elapsed)}
                      onClick={(e) => {
                        const box = e.currentTarget.getBoundingClientRect();
                        seekTo(group, ((e.clientX - box.left) / box.width) * total);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") seekTo(group, elapsed + 15);
                        if (e.key === "ArrowLeft") seekTo(group, Math.max(elapsed - 15, 0));
                      }}
                      className="flex h-3 cursor-pointer items-center"
                    >
                      <div className="relative h-1 w-full rounded-full bg-graphite/10">
                        <div
                          className="absolute left-0 top-0 h-1 rounded-full bg-orange"
                          style={{ width: `${total ? (elapsed / total) * 100 : 0}%` }}
                        />
                        {/* Marca só onde o pet mudou de sala — as emendas dos
                            segmentos de 10 min não interessam a ele. */}
                        {group.rooms?.slice(1).map((room, i) => {
                          const at = offsetOf(
                            group,
                            group.parts.findIndex((p) => p.id === room.parts[0].id),
                          );
                          return (
                            <span
                              key={`${room.key}-${i}`}
                              title={`Trocou para ${room.label}`}
                              className="absolute -top-1 h-3 w-0.5 rounded-sm bg-petrol"
                              style={{ left: `${total ? (at / total) * 100 : 0}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] tabular-nums text-gray-neutral">
                      <span>{fmtElapsed(elapsed)}</span>
                      <span>{fmtElapsed(total)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(group.rooms ?? [{ key: "", label: "", parts: group.parts }]).map(
                      (room, roomIdx) => (
                        <div key={`${room.key}-${roomIdx}`} className="space-y-0.5">
                          {group.rooms && (
                            <div className="flex items-center gap-1.5 pb-1">
                              <Video className="h-3.5 w-3.5 shrink-0 text-petrol" />
                              <span className="text-xs font-semibold text-petrol">
                                {room.label}
                              </span>
                            </div>
                          )}
                          {room.parts.map((part) => {
                            const index = group.parts.findIndex((p) => p.id === part.id);
                            const current = part.id === activeId;
                            return (
                              <button
                                key={part.id}
                                type="button"
                                disabled={loading}
                                onClick={() => playPart(group, index)}
                                className={`-mx-2 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-2 text-left ${
                                  current ? "bg-surface-muted" : ""
                                }`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                                    current
                                      ? "bg-orange text-white"
                                      : "bg-surface-muted text-gray-neutral"
                                  }`}
                                >
                                  {index + 1}
                                </span>
                                <span
                                  className={`min-w-0 flex-1 text-sm text-graphite ${
                                    current ? "font-semibold" : ""
                                  }`}
                                >
                                  {fmtClock(part.startedAt)}
                                  {part.durationSec
                                    ? ` · ${Math.max(Math.round(part.durationSec / 60), 1)} min`
                                    : ""}
                                </span>
                                {current && playing && (
                                  <span className="flex shrink-0 items-end gap-0.5" aria-hidden>
                                    <span className="h-2.5 w-0.5 rounded-sm bg-orange" />
                                    <span className="h-3.5 w-0.5 rounded-sm bg-orange" />
                                    <span className="h-2 w-0.5 rounded-sm bg-orange" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>

                  {group.inProgress && (
                    <p className="text-xs text-gray-neutral">
                      O atendimento está em andamento — novas partes aparecem aqui conforme
                      são gravadas.
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
