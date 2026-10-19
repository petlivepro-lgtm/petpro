"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, ChoiceChips, FileInput, Input, Label, Textarea } from "@mylivepet/ui";
import { TENANT_SUPPORT_CATEGORIES } from "@mylivepet/types";
import { openSupportTicket } from "./actions";

export function NewTicketForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hint = TENANT_SUPPORT_CATEGORIES.find((c) => c.value === category)?.hint;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    data.set("category", category ?? "");
    data.set("page", document.referrer ? new URL(document.referrer).pathname : "/suporte");
    start(async () => {
      const res = await openSupportTicket(data);
      if (!res.ok) return setError(res.error);
      router.push(`/suporte/${res.id}${res.warning ? "?anexo=falhou" : ""}`);
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <span className="mb-1.5 block text-sm font-medium text-graphite">Sobre o quê?</span>
        <ChoiceChips
          aria-label="Categoria"
          options={TENANT_SUPPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
          value={category}
          onChange={setCategory}
          allowEmpty={false}
        />
        {hint && <p className="mt-1.5 text-xs text-gray-neutral">{hint}</p>}
      </div>
      <div>
        <Label htmlFor="subject">Assunto</Label>
        <Input id="subject" name="subject" required minLength={3} maxLength={140} placeholder="Ex.: câmera da sala de tosa não abre para os tutores" />
      </div>
      <div>
        <Label htmlFor="body">O que está acontecendo?</Label>
        <Textarea id="body" name="body" rows={5} required minLength={10} maxLength={5000} placeholder="Conte o que aconteceu, desde quando e o que você já tentou." />
      </div>
      <div>
        <Label htmlFor="anexo">Print ou PDF (opcional)</Label>
        <FileInput id="anexo" name="anexo" accept="image/png,image/jpeg,image/webp,application/pdf" />
        <p className="mt-1 text-xs text-gray-neutral">Até 4 MB. Enviamos junto a página de origem e o navegador; nunca senhas.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !category} className="self-end">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : "Enviar chamado"}
      </Button>
    </form>
  );
}
