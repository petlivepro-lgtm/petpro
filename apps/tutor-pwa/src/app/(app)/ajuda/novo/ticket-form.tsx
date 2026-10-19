"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button, FileInput, Label, Textarea } from "@mylivepet/ui";
import { openTutorTicket } from "../actions";

export function TutorTicketForm({ topic, sensitive }: { topic: string; sensitive: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    data.set("assunto", topic);
    start(async () => {
      const res = await openTutorTicket(data);
      if (!res.ok) return setError(res.error);
      router.push(`/ajuda/${res.id}?enviado=1${res.warning ? "&anexo=falhou" : ""}`);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="body">{sensitive ? "Conte o que aconteceu, com data e horário" : "Conte o que aconteceu"}</Label>
        <Textarea id="body" name="body" rows={6} required minLength={10} maxLength={5000} className="text-[15px]" />
      </div>
      <div>
        <Label htmlFor="anexo">{sensitive ? "Foto (opcional)" : "Print da tela (opcional)"}</Label>
        <FileInput id="anexo" name="anexo" accept="image/png,image/jpeg,image/webp,application/pdf" />
        <p className="mt-1 text-xs text-gray-neutral">Imagem ou PDF, até 4 MB.</p>
      </div>
      <p className="flex gap-2.5 rounded-xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-graphite/80">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-petrol" aria-hidden />
        {sensitive
          ? "Este chamado é só entre você e a equipe do Pet Live Pro. O petshop não vê."
          : "Mandamos junto o petshop e a versão do app para agilizar. Nunca pedimos sua senha."}
      </p>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full text-base font-bold">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : "Enviar para o suporte"}
      </Button>
    </form>
  );
}
