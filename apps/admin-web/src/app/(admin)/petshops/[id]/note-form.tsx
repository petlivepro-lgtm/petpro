"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, Label, Textarea } from "@mylivepet/ui";
import { addTenantNote } from "./actions";

export function NoteForm({ tenantId }: { tenantId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(async () => {
      const res = await addTenantNote(tenantId, body);
      if (res.ok) setBody("");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <Label htmlFor="nota" className="mb-0">
        Nova nota
      </Label>
      <Textarea
        id="nota"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={4000}
        placeholder="Só a equipe da plataforma vê isto."
        className="focus-visible:ring-petrol"
      />
      {error && (
        <p role="alert" className="text-sm font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={pending || !body.trim()}
        className="self-end bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : "Salvar nota"}
      </Button>
    </form>
  );
}
