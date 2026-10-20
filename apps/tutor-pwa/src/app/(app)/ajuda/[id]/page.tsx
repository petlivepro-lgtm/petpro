import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { SupportChat, SupportStatusChip, type SupportChatMessage } from "@mylivepet/ui";
import { SUPPORT_CATEGORY_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { closeTutorTicket, markTutorTicketRead, replyTutorTicket } from "../actions";

export default async function ChamadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enviado?: string; anexo?: string }>;
}) {
  const { id } = await params;
  const { enviado, anexo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  // RLS: só chamado aberto por este tutor; mensagens e anexos sem notas internas.
  const [{ data: ticket }, { data: messages }, { data: attachments }, { data: read }] = await Promise.all([
    supabase
      .from("support_ticket")
      .select("id, number, category, subject, status, first_response_due_at, satisfaction_rating")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("support_message").select("id, author_kind, author_name, body, created_at").eq("ticket_id", id).order("created_at"),
    supabase.from("support_attachment").select("id, message_id, file_name, mime_type, size_bytes").eq("ticket_id", id).order("created_at"),
    supabase.from("support_read").select("last_read_at").eq("ticket_id", id).maybeSingle(),
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
    <div className="space-y-4 lg:max-w-2xl">
      <RealtimeRefresh
        channel={`ajuda-${ticket.id}`}
        watches={[
          { table: "support_message", filter: `ticket_id=eq.${ticket.id}` },
          { table: "support_ticket", filter: `id=eq.${ticket.id}` },
        ]}
      />
      <Link href="/ajuda" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-graphite/70 hover:text-graphite">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Ajuda
      </Link>
      {enviado && (
        <div role="status" className="flex gap-3 rounded-2xl bg-success/10 p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden />
          <div className="space-y-0.5">
            <p className="font-bold text-graphite">Recebemos seu chamado #{ticket.number}</p>
            <p className="text-sm text-graphite/75">Você recebe um aviso no app quando a gente responder.</p>
            {anexo === "falhou" && <p className="text-sm text-graphite/75">O anexo não subiu — anexe de novo aqui na conversa.</p>}
          </div>
        </div>
      )}
      <header className="space-y-1.5">
        <p className="flex flex-wrap items-center gap-2 text-sm text-gray-neutral">
          <span className="font-semibold tabular-nums text-graphite/80">#{ticket.number}</span>
          <span aria-hidden>·</span>
          {SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category}
          <SupportStatusChip status={status} className="ml-auto" />
        </p>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">{ticket.subject}</h1>
      </header>

      <SupportChat
        layout="page"
        ticketId={ticket.id}
        ticketNumber={ticket.number}
        status={status}
        messages={chat}
        attachmentBase="/ajuda/anexo"
        firstResponseDueAt={ticket.first_response_due_at}
        rating={ticket.satisfaction_rating}
        unread={unread}
        reply={replyTutorTicket.bind(null, ticket.id)}
        close={closeTutorTicket.bind(null, ticket.id)}
        markRead={markTutorTicketRead.bind(null, ticket.id)}
        closedFooter={
          <>
            Este chamado foi encerrado e não recebe mais mensagens.{" "}
            <Link href="/ajuda" className="font-semibold text-petrol hover:underline">
              Abrir um novo em Ajuda
            </Link>
          </>
        }
      />
    </div>
  );
}
