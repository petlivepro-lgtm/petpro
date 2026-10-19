import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft } from "lucide-react";
import { SUPPORT_STATUS_LABEL, type SupportStatus } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { TutorReplyForm } from "./reply-form";

function when(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  // RLS: só chamado aberto por este tutor; mensagens sem notas internas.
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    supabase.from("support_ticket").select("id, number, subject, status").eq("id", id).maybeSingle(),
    supabase.from("support_message").select("id, author_kind, author_name, body, created_at").eq("ticket_id", id).order("created_at"),
  ]);
  if (!ticket) notFound();
  const status = ticket.status as SupportStatus;

  return (
    <div className="space-y-5 lg:max-w-2xl">
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
            {anexo === "falhou" && <p className="text-sm text-graphite/75">O anexo não subiu — descreva o que viu aqui na conversa.</p>}
          </div>
        </div>
      )}
      <header className="space-y-1">
        <h1 className="font-heading text-xl font-bold text-graphite">{ticket.subject}</h1>
        <p className="text-sm text-gray-neutral">
          #{ticket.number} · {SUPPORT_STATUS_LABEL[status]}
        </p>
      </header>
      <ol className="space-y-3.5">
        {(messages ?? []).map((m) =>
          m.author_kind === "SYSTEM" ? null : (
            <li key={m.id} className={`flex max-w-[88%] flex-col gap-1 ${m.author_kind === "ADMIN" ? "items-start" : "ml-auto items-end"}`}>
              <span className="text-xs text-gray-neutral">
                <strong className="text-graphite">{m.author_kind === "ADMIN" ? "Equipe Pet Live Pro" : "Você"}</strong> · {when(m.created_at)}
              </span>
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
                  m.author_kind === "ADMIN" ? "bg-petrol text-white" : "bg-surface-muted text-graphite"
                }`}
              >
                {m.body}
              </p>
            </li>
          ),
        )}
      </ol>
      {status === "CLOSED" ? (
        <p className="text-sm text-gray-neutral">Este chamado foi encerrado. Abra um novo em Ajuda, se precisar.</p>
      ) : (
        <TutorReplyForm ticketId={ticket.id} />
      )}
    </div>
  );
}
