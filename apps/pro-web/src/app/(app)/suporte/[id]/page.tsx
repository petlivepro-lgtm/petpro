import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardPaste, Clock3, Lightbulb, MapPin } from "lucide-react";
import { Card, RatingStars, SupportChat, SupportStatusChip, type SupportChatMessage } from "@mylivepet/ui";
import { SUPPORT_CATEGORY_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { closeSupportTicket, markSupportRead, replySupportTicket } from "../actions";
import { CopyNumber } from "./copy-number";

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "45 min", "3 h 10 min", "2 dias". */
function span(fromIso: string, toIso: string) {
  const min = Math.max(1, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
  return `${Math.round(min / (24 * 60))} dias`;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-gray-neutral">{label}</dt>
      <dd className="text-right font-medium text-graphite">{children}</dd>
    </div>
  );
}

export default async function SuporteTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ anexo?: string }>;
}) {
  const { id } = await params;
  const { anexo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS devolve o chamado só se for deste petshop, e as mensagens e anexos
  // sem as notas internas da equipe.
  const [{ data: ticket }, { data: messages }, { data: attachments }, { data: read }, { data: me }] = await Promise.all([
    supabase
      .from("support_ticket")
      .select("id, number, category, subject, status, created_at, updated_at, first_response_due_at, first_response_at, satisfaction_rating")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("support_message").select("id, author_kind, author_name, body, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("support_attachment").select("id, message_id, file_name, mime_type, size_bytes").eq("ticket_id", id).order("created_at"),
    supabase.from("support_read").select("last_read_at").eq("ticket_id", id).maybeSingle(),
    user ? supabase.from("profile").select("full_name").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!ticket) notFound();
  const status = ticket.status as SupportStatus;

  const byMessage = new Map<string, SupportChatMessage["attachments"]>();
  for (const a of attachments ?? []) {
    if (!a.message_id) continue;
    byMessage.set(a.message_id, [...(byMessage.get(a.message_id) ?? []), a]);
  }
  const chat: SupportChatMessage[] = (messages ?? []).map((m) => ({
    ...m,
    author_kind: m.author_kind as SupportChatMessage["author_kind"],
    attachments: byMessage.get(m.id) ?? [],
  }));
  const lastRead = read?.last_read_at ? new Date(read.last_read_at).getTime() : 0;
  const unread = chat.some((m) => m.author_kind === "ADMIN" && new Date(m.created_at).getTime() > lastRead);

  return (
    <>
      <RealtimeRefresh
        channel={`suporte-${ticket.id}`}
        watches={[
          { table: "support_message", filter: `ticket_id=eq.${ticket.id}` },
          { table: "support_ticket", filter: `id=eq.${ticket.id}` },
        ]}
      />
      <Link href="/suporte" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-graphite/70 hover:text-graphite">
        <ChevronLeft className="h-4 w-4" /> Ajuda e suporte
      </Link>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-neutral">
            <CopyNumber number={ticket.number} />
            <span aria-hidden>·</span>
            {SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-graphite">{ticket.subject}</h1>
        </div>
        <SupportStatusChip status={status} className="text-[13px]" />
      </header>

      {anexo === "falhou" && (
        <p role="status" className="mb-4 rounded-xl bg-warning/15 px-4 py-3 text-sm text-graphite">
          O chamado foi aberto, mas o anexo não subiu. Anexe de novo pela conversa.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <SupportChat
          ticketId={ticket.id}
          ticketNumber={ticket.number}
          status={status}
          messages={chat}
          attachmentBase="/suporte/anexo"
          viewerName={me?.full_name ?? null}
          firstResponseDueAt={ticket.first_response_due_at}
          rating={ticket.satisfaction_rating}
          unread={unread}
          reply={replySupportTicket.bind(null, ticket.id)}
          close={closeSupportTicket.bind(null, ticket.id)}
          markRead={markSupportRead.bind(null, ticket.id)}
          closedFooter={
            <>
              Este chamado foi encerrado e não recebe mais mensagens.{" "}
              <Link href="/suporte" className="font-semibold text-petrol hover:underline">
                Abrir um novo chamado
              </Link>
            </>
          }
          className="h-[75dvh] min-h-[440px] lg:h-[calc(100dvh-12rem)] lg:min-h-[520px]"
        />

        <aside className="flex flex-col gap-4">
          <Card className="p-4">
            <h2 className="mb-3 font-heading text-sm font-bold text-graphite">Detalhes</h2>
            <dl className="divide-y divide-graphite/[0.06] text-[13px]">
              <Detail label="Aberto em">{when(ticket.created_at)}</Detail>
              <Detail label="Primeira resposta">
                {ticket.first_response_at
                  ? `em ${span(ticket.created_at, ticket.first_response_at)}`
                  : status === "CLOSED" || status === "RESOLVED"
                    ? "—"
                    : `prevista até ${when(ticket.first_response_due_at)}`}
              </Detail>
              <Detail label="Última atualização">{when(ticket.updated_at)}</Detail>
              {ticket.satisfaction_rating && (
                <Detail label="Sua avaliação">
                  <RatingStars value={ticket.satisfaction_rating} size="sm" className="justify-end" />
                </Detail>
              )}
            </dl>
          </Card>

          {status !== "CLOSED" && (
            <Card className="p-4">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-graphite">
                <Lightbulb className="h-4 w-4 text-orange" aria-hidden /> Para resolver mais rápido
              </h2>
              <ul className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-graphite/80">
                <li className="flex gap-2.5">
                  <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-gray-neutral" aria-hidden />
                  Mande um print da tela: tire com Win + Shift + S e cole aqui com Ctrl + V.
                </li>
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-neutral" aria-hidden />
                  Diga em qual tela estava e o que clicou antes do problema.
                </li>
                <li className="flex gap-2.5">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-gray-neutral" aria-hidden />
                  Informe quando aconteceu e se ainda está acontecendo.
                </li>
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
