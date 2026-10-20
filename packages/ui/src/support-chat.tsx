"use client";

import * as React from "react";
import { SUPPORT_ATTACHMENT_MAX_BYTES, type SupportStatus } from "@mylivepet/types";
import { cn } from "./cn";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Label } from "./input";
import { Textarea } from "./textarea";
import { RatingStars } from "./rating-stars";
import { ChatScroll } from "./chat-scroll";
import { useScrollLock } from "./use-scroll-lock";

// Conversa de um chamado com o suporte do Pet Live Pro, do lado do cliente
// (painel do petshop e app do tutor). Os dados chegam do servidor já
// recortados pela RLS; as ações (responder, encerrar, marcar como lido) são
// server actions do app, ligadas ao chamado com .bind.

export type SupportChatAttachment = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  /** Só na mensagem otimista: URL local da imagem antes de subir. */
  preview?: string;
};

export type SupportChatMessage = {
  id: string;
  author_kind: "CUSTOMER" | "ADMIN" | "SYSTEM";
  author_name: string | null;
  body: string;
  created_at: string;
  attachments: SupportChatAttachment[];
  pending?: boolean;
};

export type SupportChatResult = { ok: true } | { ok: false; error: string };

const TZ = "America/Sao_Paulo";
const TEAM = "Equipe Pet Live Pro";
const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_CHARS = 5000;
const GROUP_MS = 5 * 60_000;
const RATING_LABEL = ["", "Muito ruim", "Ruim", "Razoável", "Bom", "Excelente"];
const FILE_ERROR = "O anexo precisa ser imagem (PNG, JPG, WEBP) ou PDF de até 4 MB.";

// ---------------------------------------------------------------------
// Ícones (o pacote de UI não depende de biblioteca de ícones)
// ---------------------------------------------------------------------

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("h-4 w-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

const Icons = {
  clip: (c?: string) => (
    <Svg className={c}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </Svg>
  ),
  send: (c?: string) => (
    <Svg className={c}>
      <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
      <path d="M6 12h16" />
    </Svg>
  ),
  x: (c?: string) => (
    <Svg className={c}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  ),
  file: (c?: string) => (
    <Svg className={c}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </Svg>
  ),
  clock: (c?: string) => (
    <Svg className={c}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </Svg>
  ),
  check: (c?: string) => (
    <Svg className={c}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </Svg>
  ),
  reply: (c?: string) => (
    <Svg className={c}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </Svg>
  ),
  info: (c?: string) => (
    <Svg className={c}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  ),
  lock: (c?: string) => (
    <Svg className={c}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  ),
  headset: (c?: string) => (
    <Svg className={c}>
      <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z" />
      <path d="M21 16v2a4 4 0 0 1-4 4h-5" />
    </Svg>
  ),
  download: (c?: string) => (
    <Svg className={c}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </Svg>
  ),
  spinner: (c?: string) => (
    <Svg className={cn("animate-spin", c)}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Svg>
  ),
};

// ---------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(iso: string, now: Date) {
  const d = new Date(iso);
  const key = dayKey(d);
  if (key === dayKey(now)) return "Hoje";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Ontem";
  const sameYear = d.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" }) === now.toLocaleDateString("en-CA", { timeZone: TZ, year: "numeric" });
  return d.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    ...(sameYear ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }),
  });
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** "hoje às 18:20", "amanhã às 10:00" ou "qua., 21/10 às 10:00". */
function dueLabel(iso: string, now: Date) {
  const d = new Date(iso);
  const key = dayKey(d);
  const at = `às ${timeLabel(iso)}`;
  if (key === dayKey(now)) return `hoje ${at}`;
  if (key === dayKey(new Date(now.getTime() + 86_400_000))) return `amanhã ${at}`;
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit" })} ${at}`;
}

function sizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Texto puro com links clicáveis. Nada vira HTML: só nós do React. */
function linkify(text: string, mine: boolean) {
  return text.split(URL_RE).map((part, i) => {
    if (i % 2 === 0) return part;
    const trail = /[.,;:!?)\]]+$/.exec(part)?.[0] ?? "";
    const href = trail ? part.slice(0, -trail.length) : part;
    return (
      <React.Fragment key={i}>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cn("break-all underline underline-offset-2", mine ? "text-white" : "text-petrol hover:text-petrol/80")}
        >
          {href}
        </a>
        {trail}
      </React.Fragment>
    );
  });
}

function validFile(file: File) {
  return ACCEPT.split(",").includes(file.type) && file.size > 0 && file.size <= SUPPORT_ATTACHMENT_MAX_BYTES;
}

// ---------------------------------------------------------------------
// Linhas da conversa: separador de dia + mensagens agrupadas por autor
// ---------------------------------------------------------------------

type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "msg"; message: SupportChatMessage; first: boolean };

function buildRows(messages: SupportChatMessage[], now: Date): Row[] {
  const rows: Row[] = [];
  let lastDay = "";
  let prev: SupportChatMessage | null = null;
  for (const m of messages) {
    const day = dayKey(new Date(m.created_at));
    if (day !== lastDay) {
      rows.push({ kind: "day", key: `d-${day}`, label: dayLabel(m.created_at, now) });
      lastDay = day;
      prev = null;
    }
    const first =
      !prev ||
      m.author_kind === "SYSTEM" ||
      prev.author_kind !== m.author_kind ||
      prev.author_name !== m.author_name ||
      new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > GROUP_MS;
    rows.push({ kind: "msg", message: m, first });
    prev = m;
  }
  return rows;
}

// ---------------------------------------------------------------------
// Peças
// ---------------------------------------------------------------------

function TeamAvatar() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-petrol text-white" aria-hidden>
      {Icons.headset("h-4 w-4")}
    </span>
  );
}

/**
 * Anexos de uma mensagem: imagem em miniatura que amplia por cima da tela,
 * PDF como cartão que abre em outra aba. `base` é a rota do app que entrega
 * o arquivo (`${base}/${id}`, com `?download=1` para baixar).
 */
export function SupportAttachments({
  items,
  base,
  align = "start",
}: {
  items: SupportChatAttachment[];
  base: string;
  align?: "start" | "end";
}) {
  const [viewing, setViewing] = React.useState<SupportChatAttachment | null>(null);
  const onOpenImage = setViewing;
  return (
    <div className={cn("flex flex-wrap gap-2", align === "end" ? "justify-end" : "justify-start")}>
      {items.map((a) =>
        a.mime_type.startsWith("image/") ? (
          <button
            key={a.id}
            type="button"
            onClick={() => onOpenImage(a)}
            className="group relative overflow-hidden rounded-xl border border-graphite/10 bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
            aria-label={`Ampliar imagem ${a.file_name}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.preview ?? `${base}/${a.id}`}
              alt={a.file_name}
              loading="lazy"
              className="block max-h-56 w-auto max-w-[240px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>
        ) : (
          <a
            key={a.id}
            href={a.preview ? undefined : `${base}/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[280px] items-center gap-3 rounded-xl border border-graphite/10 bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-muted"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">{Icons.file("h-[18px] w-[18px]")}</span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-graphite">{a.file_name}</span>
              <span className="text-xs text-gray-neutral">PDF · {sizeLabel(a.size_bytes)}</span>
            </span>
          </a>
        ),
      )}
      <ImageViewer image={viewing} base={base} onClose={() => setViewing(null)} />
    </div>
  );
}

function MessageItem({
  message: m,
  first,
  viewerName,
  base,
  large,
}: {
  message: SupportChatMessage;
  first: boolean;
  viewerName?: string | null;
  base: string;
  large: boolean;
}) {
  if (m.author_kind === "SYSTEM") {
    return (
      <li className="flex justify-center py-1">
        <p className="flex max-w-[90%] items-start gap-2 rounded-xl bg-graphite/[0.05] px-3 py-2 text-xs leading-relaxed text-graphite/70">
          {Icons.info("mt-px h-3.5 w-3.5 text-graphite/45")}
          <span>{m.body}</span>
        </p>
      </li>
    );
  }

  const mine = m.author_kind === "CUSTOMER";
  const who = !mine ? TEAM : !viewerName || !m.author_name || m.author_name === viewerName ? "Você" : m.author_name;
  const time = timeLabel(m.created_at);

  return (
    <li className={cn("flex gap-2.5", mine ? "justify-end" : "justify-start", first ? "mt-2.5" : "mt-1")}>
      {!mine && (first ? <TeamAvatar /> : <span className="w-8 shrink-0" aria-hidden />)}
      <div className={cn("flex min-w-0 max-w-[min(85%,560px)] flex-col gap-1.5", mine ? "items-end" : "items-start")}>
        {first && (
          <span className="px-1 text-xs text-gray-neutral" suppressHydrationWarning>
            <strong className="font-semibold text-graphite">{who}</strong> · {time}
          </span>
        )}
        {m.body && (
          <p
            title={first ? undefined : time}
            className={cn(
              "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 leading-relaxed",
              large ? "text-[15px]" : "text-sm",
              mine
                ? cn("bg-petrol text-white", first && "rounded-tr-md")
                : cn("border border-graphite/[0.08] bg-surface text-graphite shadow-[0_1px_2px_rgba(31,42,51,0.05)]", first && "rounded-tl-md"),
              m.pending && "opacity-60",
            )}
          >
            {linkify(m.body, mine)}
          </p>
        )}
        {m.attachments.length > 0 && (
          <div className={cn(m.pending && "opacity-60")}>
            <SupportAttachments items={m.attachments} base={base} align={mine ? "end" : "start"} />
          </div>
        )}
        {m.pending && (
          <span className="flex items-center gap-1 px-1 text-[11px] text-gray-neutral">
            {Icons.clock("h-3 w-3")} Enviando…
          </span>
        )}
      </div>
    </li>
  );
}

function ImageViewer({ image, base, onClose }: { image: SupportChatAttachment | null; base: string; onClose: () => void }) {
  useScrollLock(!!image);
  React.useEffect(() => {
    if (!image) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [image, onClose]);
  if (!image) return null;
  const src = image.preview ?? `${base}/${image.id}`;
  return (
    <div role="dialog" aria-modal="true" aria-label={image.file_name} className="fixed inset-0 z-50 flex flex-col bg-graphite/90" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{image.file_name}</span>
        {!image.preview && (
          <a
            href={`${src}?download=1`}
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-white/10"
          >
            {Icons.download()} Baixar
          </a>
        )}
        <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-xl transition-colors hover:bg-white/10">
          {Icons.x("h-5 w-5")}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={image.file_name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  );
}

type BannerTone = "neutral" | "info" | "brand" | "success";

const BANNER_TONE: Record<BannerTone, string> = {
  neutral: "bg-graphite/[0.04] text-graphite/70",
  info: "bg-petrol/[0.07] text-petrol",
  brand: "bg-orange/10 text-orange",
  success: "bg-success/10 text-success",
};

function StatusBanner({
  status,
  dueAt,
  answered,
  rating,
  now,
  onClose,
  onKeepOpen,
  boxed,
}: {
  status: SupportStatus;
  dueAt?: string | null;
  answered: boolean;
  rating?: number | null;
  now: Date;
  onClose: () => void;
  onKeepOpen: () => void;
  boxed: boolean;
}) {
  let tone: BannerTone = "info";
  let icon = Icons.clock("h-[18px] w-[18px]");
  let title = "";
  let text: React.ReactNode = null;

  switch (status) {
    case "NEW":
      title = "Chamado recebido";
      text =
        dueAt && new Date(dueAt).getTime() > now.getTime()
          ? `A equipe responde até ${dueLabel(dueAt, now)}. Você recebe um aviso quando houver resposta.`
          : "A equipe já foi avisada e responde em breve. Você recebe um aviso quando houver resposta.";
      break;
    case "IN_PROGRESS":
      title = "Em análise";
      text = answered
        ? "A equipe está cuidando do seu retorno. Você recebe um aviso quando houver resposta."
        : "A equipe está cuidando do seu chamado. Você recebe um aviso quando houver resposta.";
      break;
    case "WAITING_CUSTOMER":
      tone = "brand";
      icon = Icons.reply("h-[18px] w-[18px]");
      title = "A equipe respondeu";
      text = "Responda aqui se ainda precisar de ajuda — ou encerre o chamado se já resolveu.";
      break;
    case "RESOLVED":
      tone = "success";
      icon = Icons.check("h-[18px] w-[18px]");
      title = "Marcado como resolvido";
      text = "Deu tudo certo? Encerre o chamado e conte como foi o atendimento.";
      break;
    case "CLOSED":
      tone = "neutral";
      icon = Icons.lock("h-[18px] w-[18px]");
      title = "Chamado encerrado";
      text = rating ? (
        <span className="flex flex-wrap items-center gap-1.5">
          Sua avaliação: <RatingStars value={rating} size="sm" /> <span className="sr-only">{rating} de 5</span>
        </span>
      ) : (
        "Ele não recebe mais mensagens. Se precisar, abra um novo."
      );
      break;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5",
        boxed ? "rounded-2xl border border-graphite/[0.08] bg-surface" : "border-b border-graphite/[0.08] bg-surface",
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", BANNER_TONE[tone])}>{icon}</span>
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-semibold text-graphite">{title}</p>
        <div className="text-[13px] leading-relaxed text-gray-neutral" suppressHydrationWarning>
          {text}
        </div>
      </div>
      {status === "RESOLVED" ? (
        <div className="flex w-full gap-2 sm:w-auto">
          <Button type="button" size="sm" variant="secondary" onClick={onKeepOpen} className="flex-1 sm:flex-none">
            Ainda não
          </Button>
          <Button type="button" size="sm" onClick={onClose} className="flex-1 bg-success hover:bg-success/90 focus-visible:ring-success sm:flex-none">
            Sim, encerrar
          </Button>
        </div>
      ) : status !== "CLOSED" ? (
        <Button type="button" size="sm" variant="ghost" onClick={onClose} className="text-graphite/70">
          Encerrar chamado
        </Button>
      ) : null}
    </div>
  );
}

function CloseDialog({
  open,
  onOpenChange,
  number,
  askRating,
  close,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: number;
  askRating: boolean;
  close: (rating: number | null, comment: string) => Promise<SupportChatResult>;
}) {
  const [rating, setRating] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const res = await close(askRating && rating ? rating : null, askRating ? comment : "");
      if (res.ok) onOpenChange(false);
      else setError(res.error);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => !pending && onOpenChange(v)}
      title={`Encerrar o chamado #${number}`}
      description={
        askRating
          ? "Como foi o atendimento? Sua avaliação ajuda a equipe a melhorar."
          : "Encerrado, o chamado não recebe mais mensagens. Se precisar, é só abrir outro."
      }
    >
      {askRating && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1.5 rounded-2xl bg-surface-muted py-4">
            <RatingStars value={rating} onChange={setRating} size="lg" />
            <span className="h-5 text-sm font-medium text-graphite/80">{rating ? RATING_LABEL[rating] : "Toque nas estrelas"}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="support-close-comment">Quer contar mais? (opcional)</Label>
            <Textarea
              id="support-close-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="O que foi bom, o que poderia ser melhor…"
            />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
          Voltar
        </Button>
        <Button type="button" onClick={confirm} disabled={pending}>
          {pending ? Icons.spinner() : "Encerrar chamado"}
        </Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------

export function SupportChat({
  ticketId,
  ticketNumber,
  status,
  messages,
  attachmentBase,
  viewerName,
  firstResponseDueAt,
  rating,
  unread,
  closedFooter,
  layout = "card",
  className,
  reply,
  close,
  markRead,
}: {
  ticketId: string;
  ticketNumber: number;
  status: SupportStatus;
  messages: SupportChatMessage[];
  /** Rota do app que entrega o anexo: `${attachmentBase}/${id}`. */
  attachmentBase: string;
  /** Nome de quem vê. Mensagem de outra pessoa do mesmo lado aparece com o nome dela. */
  viewerName?: string | null;
  firstResponseDueAt?: string | null;
  rating?: number | null;
  /** Há resposta da equipe que esta pessoa ainda não leu. */
  unread?: boolean;
  /** O que aparece no lugar do campo de resposta quando o chamado está encerrado. */
  closedFooter?: React.ReactNode;
  /** "card": altura fixa e rolagem própria (painel). "page": rola com a página e o campo fica preso embaixo (app). */
  layout?: "card" | "page";
  className?: string;
  reply: (formData: FormData) => Promise<SupportChatResult>;
  close: (rating: number | null, comment: string) => Promise<SupportChatResult>;
  markRead?: () => Promise<void>;
}) {
  const [now] = React.useState(() => new Date());
  const [optimistic, addOptimistic] = React.useOptimistic(messages, (state, m: SupportChatMessage) => [...state, m]);
  const [pending, startTransition] = React.useTransition();
  const [body, setBody] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [coarse, setCoarse] = React.useState(false);
  const [hint, setHint] = React.useState<string | null>(null);
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const dragDepth = React.useRef(0);
  const draftKey = `pet-suporte-rascunho:${ticketId}`;
  const closed = status === "CLOSED";
  const answered = optimistic.some((m) => m.author_kind === "ADMIN");
  const sending = optimistic.some((m) => m.pending);
  const rows = React.useMemo(() => buildRows(optimistic, now), [optimistic, now]);

  // Toque: Enter quebra linha (o teclado do celular não tem Shift fácil).
  React.useEffect(() => {
    setCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Rascunho por chamado, só neste navegador.
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) setBody(saved);
    } catch {
      /* armazenamento bloqueado: segue sem rascunho */
    }
  }, [draftKey]);

  function saveDraft(value: string) {
    try {
      if (value.trim()) localStorage.setItem(draftKey, value);
      else localStorage.removeItem(draftKey);
    } catch {
      /* idem */
    }
  }

  // O campo cresce com o texto até um teto, depois rola.
  React.useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
  }, [body]);

  // Prévia da imagem escolhida. A URL vive um pouco além da escolha porque a
  // mensagem otimista ainda a mostra enquanto o envio termina.
  React.useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };
  }, [file]);

  // Leu a conversa: marca uma vez por resposta nova da equipe.
  const lastAdmin = [...messages].reverse().find((m) => m.author_kind === "ADMIN")?.id;
  const markedFor = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    if (!unread || !markRead || !lastAdmin || markedFor.current === lastAdmin) return;
    markedFor.current = lastAdmin;
    void markRead().catch(() => undefined);
  }, [unread, markRead, lastAdmin]);

  // Layout "page": a janela é quem rola. Abre no fim e acompanha as novas.
  const atBottom = React.useRef(true);
  React.useEffect(() => {
    if (layout !== "page") return;
    const onScroll = () => {
      atBottom.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    };
    window.scrollTo(0, document.documentElement.scrollHeight);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [layout]);
  React.useEffect(() => {
    if (layout === "page" && (atBottom.current || sending)) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }, [layout, optimistic.length, sending]);

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (!validFile(f)) {
      setError(FILE_ERROR);
      return;
    }
    setError(null);
    setFile(f);
    textarea.current?.focus();
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = body.trim();
    if ((!text && !file) || pending || closed) return;
    const fd = new FormData();
    fd.set("body", text);
    if (file) fd.set("anexo", file);
    const sentBody = body;
    const sentFile = file;
    const sentPreview = preview;
    setError(null);
    startTransition(async () => {
      addOptimistic({
        id: `envio-${Date.now()}`,
        author_kind: "CUSTOMER",
        author_name: viewerName ?? null,
        body: text,
        created_at: new Date().toISOString(),
        attachments: sentFile
          ? [{ id: "envio", file_name: sentFile.name, mime_type: sentFile.type, size_bytes: sentFile.size, preview: sentPreview ?? undefined }]
          : [],
        pending: true,
      });
      setBody("");
      setFile(null);
      setHint(null);
      saveDraft("");
      const res = await reply(fd);
      if (!res.ok) {
        setError(res.error);
        setBody(sentBody);
        setFile(sentFile);
        saveDraft(sentBody);
      }
    });
  }

  function keepOpen() {
    setHint("Conte o que ainda não funcionou…");
    textarea.current?.focus();
  }

  const list = (
    <ol className={cn("flex flex-col", layout === "card" ? "px-3 py-4 sm:px-5" : "py-1")}>
      {rows.map((r) =>
        r.kind === "day" ? (
          <li key={r.key} className="my-3 flex items-center gap-3 first:mt-0" aria-label={r.label}>
            <span className="h-px flex-1 bg-graphite/[0.08]" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-neutral" suppressHydrationWarning>
              {r.label}
            </span>
            <span className="h-px flex-1 bg-graphite/[0.08]" />
          </li>
        ) : (
          <MessageItem
            key={r.message.id}
            message={r.message}
            first={r.first}
            viewerName={viewerName}
            base={attachmentBase}
            large={layout === "page"}
          />
        ),
      )}
    </ol>
  );

  const count = body.length;
  const composer = closed ? (
    <div className={cn("px-4 py-4 text-sm text-gray-neutral sm:px-5", layout === "card" && "border-t border-graphite/[0.08]")}>
      {closedFooter ?? "Este chamado foi encerrado."}
    </div>
  ) : (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-col gap-2",
        layout === "card"
          ? "border-t border-graphite/[0.08] bg-surface p-3 sm:px-5 sm:py-4"
          : "sticky bottom-[60px] z-10 -mx-5 bg-surface/95 px-5 pb-3 pt-2 backdrop-blur lg:bottom-6 lg:mx-0 lg:rounded-2xl lg:px-0 lg:pb-0 lg:pt-0 lg:bg-transparent lg:backdrop-blur-none",
      )}
    >
      {error && (
        <p role="alert" className="px-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      {file && (
        <div className="flex items-center gap-3 self-start rounded-xl border border-graphite/10 bg-surface-muted py-1.5 pl-1.5 pr-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-danger/10 text-danger">{Icons.file("h-[18px] w-[18px]")}</span>
          )}
          <span className="flex min-w-0 max-w-[220px] flex-col">
            <span className="truncate text-sm font-medium text-graphite">{file.name}</span>
            <span className="text-xs text-gray-neutral">{sizeLabel(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => setFile(null)}
            aria-label="Remover anexo"
            className="grid h-8 w-8 place-items-center rounded-lg text-graphite/60 transition-colors hover:bg-graphite/10 hover:text-graphite"
          >
            {Icons.x()}
          </button>
        </div>
      )}
      <div
        className={cn(
          "flex items-end gap-1.5 rounded-2xl border border-graphite/15 bg-surface p-1.5 transition-shadow",
          "focus-within:border-orange/60 focus-within:ring-2 focus-within:ring-orange/25",
        )}
      >
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Anexar imagem ou PDF"
          title="Anexar imagem ou PDF (até 4 MB)"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-graphite/55 transition-colors hover:bg-surface-muted hover:text-graphite"
        >
          {Icons.clip("h-[18px] w-[18px]")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="hidden"
          tabIndex={-1}
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Label htmlFor={`reply-${ticketId}`} className="sr-only">
          Sua mensagem
        </Label>
        <Textarea
          ref={textarea}
          id={`reply-${ticketId}`}
          rows={1}
          value={body}
          maxLength={MAX_CHARS}
          placeholder={hint ?? (status === "WAITING_CUSTOMER" ? "Responda à equipe…" : "Escreva uma mensagem…")}
          onChange={(e) => {
            setBody(e.target.value);
            saveDraft(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.files?.[0];
            if (pasted) {
              e.preventDefault();
              pick(pasted);
            }
          }}
          className={cn(
            "max-h-48 min-h-10 resize-none border-0 bg-transparent px-1.5 py-2.5 shadow-none focus-visible:ring-0",
            layout === "page" ? "text-[15px]" : "text-sm",
          )}
        />
        <button
          type="submit"
          disabled={pending || (!body.trim() && !file)}
          aria-label="Enviar mensagem"
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange text-white transition-colors hover:bg-orange/90",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2",
            "disabled:bg-graphite/[0.07] disabled:text-graphite/35",
          )}
        >
          {pending ? Icons.spinner("h-[18px] w-[18px]") : Icons.send("h-[18px] w-[18px]")}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-gray-neutral">
        <span className={cn(coarse ? "hidden" : "hidden sm:inline")}>
          <kbd className="font-sans font-semibold">Enter</kbd> envia · <kbd className="font-sans font-semibold">Shift + Enter</kbd> quebra linha ·
          cole um print com <kbd className="font-sans font-semibold">Ctrl + V</kbd>
        </span>
        {count > MAX_CHARS - 1000 && (
          <span className={cn("ml-auto tabular-nums", count >= MAX_CHARS && "font-semibold text-danger")}>
            {count.toLocaleString("pt-BR")}/{MAX_CHARS.toLocaleString("pt-BR")}
          </span>
        )}
      </div>
    </form>
  );

  const dropHandlers = closed
    ? {}
    : {
        onDragEnter: (e: React.DragEvent) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          dragDepth.current += 1;
          setDragging(true);
        },
        onDragLeave: () => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        },
        onDragOver: (e: React.DragEvent) => {
          if (e.dataTransfer.types.includes("Files")) e.preventDefault();
        },
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        },
      };

  const banner = (
    <StatusBanner
      status={status}
      dueAt={firstResponseDueAt}
      answered={answered}
      rating={rating}
      now={now}
      onClose={() => setClosing(true)}
      onKeepOpen={keepOpen}
      boxed={layout === "page"}
    />
  );

  return (
    <>
      {layout === "card" ? (
        <section
          aria-label={`Conversa do chamado #${ticketNumber}`}
          className={cn("relative flex min-h-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-card", className)}
          {...dropHandlers}
        >
          {banner}
          <ChatScroll count={optimistic.length} conversationKey={ticketId} pin={sending} className="min-h-0 flex-1 bg-surface-muted/60">
            {list}
          </ChatScroll>
          {composer}
          {dragging && <DropOverlay />}
        </section>
      ) : (
        <section aria-label={`Conversa do chamado #${ticketNumber}`} className={cn("relative flex flex-col gap-4", className)} {...dropHandlers}>
          {banner}
          <div role="log" aria-label="Mensagens do chamado" aria-live="polite">
            {list}
          </div>
          {composer}
          {dragging && <DropOverlay />}
        </section>
      )}
      <CloseDialog open={closing} onOpenChange={setClosing} number={ticketNumber} askRating={answered} close={close} />
    </>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-orange bg-surface/85">
      <span className="flex items-center gap-2 text-sm font-semibold text-orange">{Icons.clip("h-5 w-5")} Solte para anexar</span>
    </div>
  );
}
