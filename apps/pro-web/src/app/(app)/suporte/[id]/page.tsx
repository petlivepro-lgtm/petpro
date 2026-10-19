import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, PageHeader } from "@mylivepet/ui";
import { SUPPORT_CATEGORY_LABEL, SUPPORT_STATUS_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ChatScroll } from "@/components/chat-scroll";
import { ReplyForm } from "./reply-form";

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

  // RLS devolve o chamado só se for deste petshop, e as mensagens sem as
  // notas internas da equipe.
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("support_ticket").select("id, number, category, subject, status, created_at").eq("id", id).maybeSingle(),
    supabase.from("support_message").select("id, author_kind, author_name, body, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  if (!ticket) notFound();
  const status = ticket.status as SupportStatus;

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
      <PageHeader
        title={ticket.subject}
        subtitle={`#${ticket.number} · ${SUPPORT_CATEGORY_LABEL[ticket.category] ?? ticket.category} · ${SUPPORT_STATUS_LABEL[status]}`}
      />
      <Card className="flex flex-col gap-5">
        {anexo === "falhou" && (
          <p role="status" className="rounded-xl bg-warning/15 px-4 py-3 text-sm text-graphite">
            O chamado foi aberto, mas o anexo não subiu. Descreva o problema aqui na conversa.
          </p>
        )}
        <ChatScroll
          count={(messages ?? []).length}
          conversationKey={ticket.id}
          className="-mx-2 max-h-[min(60vh,560px)] px-2"
        >
        <ol className="flex flex-col gap-3.5 py-1">
          {(messages ?? []).map((m) =>
            m.author_kind === "SYSTEM" ? (
              <li key={m.id} className="self-center text-center text-xs text-gray-neutral">
                {m.body}
              </li>
            ) : (
              <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 ${m.author_kind === "ADMIN" ? "items-start self-start" : "items-end self-end"}`}>
                <span className="text-xs text-gray-neutral">
                  <strong className="text-graphite">{m.author_name ?? (m.author_kind === "ADMIN" ? "Equipe Pet Live Pro" : "Você")}</strong> · {when(m.created_at)}
                </span>
                <p
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
                    m.author_kind === "ADMIN" ? "bg-petrol text-white" : "bg-surface-muted text-graphite"
                  }`}
                >
                  {m.body}
                </p>
              </li>
            ),
          )}
        </ol>
        </ChatScroll>
        {status === "CLOSED" ? (
          <p className="text-sm text-gray-neutral">Este chamado foi encerrado. Abra um novo, se precisar.</p>
        ) : (
          <ReplyForm ticketId={ticket.id} />
        )}
      </Card>
    </>
  );
}
