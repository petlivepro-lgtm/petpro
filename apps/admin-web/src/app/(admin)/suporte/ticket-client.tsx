"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Label, Select, Textarea, cn } from "@mylivepet/ui";
import { postMessage, updateTicket } from "./actions";

export function Composer({ ticketId, closed, resolved }: { ticketId: string; closed: boolean; resolved: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Resolvido não fala mais com o cliente: só nota interna. Responder exige
  // reabrir pela situação (o servidor recusa do mesmo jeito).
  const note = resolved || mode === "note";

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
      {resolved ? (
        <p className="text-[13px] text-gray-neutral">
          <span className="font-semibold text-graphite">Chamado resolvido.</span> O cliente não recebe mais mensagens; só
          notas internas. Para responder, reabra mudando a situação.
        </p>
      ) : (
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
      )}
      <Label htmlFor="msg" className="sr-only">
        Mensagem
      </Label>
      <Textarea
        id="msg"
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl+Enter (Cmd+Enter no Mac) envia; Enter sozinho segue quebrando linha.
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
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
          <span className="ml-1.5 hidden whitespace-nowrap text-graphite/50 sm:inline">
            · <kbd className="font-sans font-semibold">Ctrl + Enter</kbd> envia
          </span>
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
