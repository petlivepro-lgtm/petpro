"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Label, Textarea } from "@mylivepet/ui";
import { replySupportTicket } from "../actions";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const res = await replySupportTicket(ticketId, body);
      if (!res.ok) return setError(res.error);
      setBody("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Label htmlFor="reply" className="sr-only">
        Sua resposta
      </Label>
      <Textarea id="reply" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Escreva sua resposta…" />
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !body.trim()} className="self-end">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : "Responder"}
      </Button>
    </form>
  );
}
