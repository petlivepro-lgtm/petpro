"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";
import { Button, Label, Select, Textarea, cn } from "@mylivepet/ui";
import { openAttachment, postMessage, updateTicket } from "./actions";

export function Composer({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const note = mode === "note";

  if (closed) {
    return <p className="border-t border-graphite/[0.08] px-5 py-4 text-sm text-gray-neutral">Chamado encerrado. Reabra mudando a situação.</p>;
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const res = await postMessage(ticketId, body, note);
      if (res.ok) {
        setBody("");
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <form
      onSubmit={send}
      className={cn("flex flex-col gap-2.5 rounded-b-[14px] border-t border-graphite/[0.08] px-5 pb-5 pt-4", note ? "bg-[#FDF8EE]" : "bg-[#FBFCFD]")}
    >
      <div role="group" aria-label="Tipo de mensagem" className="flex self-start rounded-[10px] border border-graphite/[0.12] bg-surface p-[3px]">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "min-h-[34px] rounded-[7px] px-3 text-[13px] font-semibold transition-colors",
              mode === m ? (m === "note" ? "bg-[#C98A12] text-white" : "bg-petrol text-white") : "text-gray-neutral hover:text-graphite",
            )}
          >
            {m === "reply" ? "Responder ao cliente" : "Nota interna"}
          </button>
        ))}
      </div>
      <Label htmlFor="msg" className="sr-only">
        Mensagem
      </Label>
      <Textarea
        id="msg"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        placeholder={note ? "Anotação para a equipe — o cliente nunca vê." : "Escreva a resposta para o cliente…"}
        className="bg-surface focus-visible:ring-petrol"
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-auto text-xs text-gray-neutral">
          {note
            ? "Fica no chamado e na auditoria, fora da visão do cliente."
            : "O cliente recebe um aviso no app com o link, sem o texto."}
        </span>
        <Button
          type="submit"
          disabled={pending || !body.trim()}
          className={note ? "bg-[#C98A12] hover:bg-[#C98A12]/90 focus-visible:ring-[#C98A12]" : "bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol"}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : note ? "Salvar nota" : "Enviar resposta"}
        </Button>
      </div>
    </form>
  );
}

export function TicketControls({
  ticketId,
  status,
  priority,
  assigned,
  admins,
}: {
  ticketId: string;
  status: string;
  priority: string;
  assigned: string | null;
  admins: { user_id: string; name: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(patch: { status?: string; priority?: string; assigned?: string }) {
    setError(null);
    start(async () => {
      const res = await updateTicket(ticketId, patch as Parameters<typeof updateTicket>[1]);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="t-status" className="text-xs text-gray-neutral">Situação</Label>
        <Select id="t-status" value={status} onChange={(e) => change({ status: e.target.value })} disabled={pending}>
          <option value="NEW">Novo</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="WAITING_CUSTOMER">Aguardando cliente</option>
          <option value="RESOLVED">Resolvido</option>
          <option value="CLOSED">Encerrado</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="t-priority" className="text-xs text-gray-neutral">Prioridade</Label>
        <Select id="t-priority" value={priority} onChange={(e) => change({ priority: e.target.value })} disabled={pending}>
          <option value="URGENT">Urgente</option>
          <option value="HIGH">Alta</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Baixa</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="t-owner" className="text-xs text-gray-neutral">Responsável</Label>
        <Select id="t-owner" value={assigned ?? ""} onChange={(e) => change({ assigned: e.target.value })} disabled={pending}>
          <option value="">Ninguém ainda</option>
          {admins.map((a) => (
            <option key={a.user_id} value={a.user_id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      {error && (
        <p role="alert" className="text-sm font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      {status !== "RESOLVED" && status !== "CLOSED" && (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => change({ status: "RESOLVED" })}
          className="border-success/40 bg-success/[0.08] font-bold text-[#22603F] hover:bg-success/15"
        >
          Marcar como resolvido
        </Button>
      )}
    </div>
  );
}

export function AttachmentButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await openAttachment(id);
          if (res.ok) window.open(res.data, "_blank", "noopener,noreferrer");
          else setError(true);
        })
      }
      className="flex min-h-9 items-center gap-2 rounded-lg border border-graphite/15 bg-surface px-3 text-[13px] font-medium text-graphite transition-colors hover:bg-surface-muted"
    >
      <Paperclip className="h-4 w-4" aria-hidden />
      {error ? "Não abriu — tente de novo" : name}
    </button>
  );
}
