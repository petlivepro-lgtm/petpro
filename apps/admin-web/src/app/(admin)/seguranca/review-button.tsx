"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Dialog, Label, Textarea } from "@mylivepet/ui";
import { reviewUploadIncident } from "./actions";

/** "Marcar como analisado", com uma observação opcional que vai para a auditoria. */
export function ReviewButton({ id, fileName }: { id: string; fileName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    setError(null);
    start(async () => {
      const res = await reviewUploadIncident(id, note);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)} className="whitespace-nowrap">
        Marcar como analisado
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => !pending && setOpen(v)}
        title="Marcar como analisado"
        description={`O registro de “${fileName}” sai da lista de pendentes e continua no histórico.`}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`note-${id}`}>O que foi feito (opcional)</Label>
          <Textarea
            id={`note-${id}`}
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ex.: falei com o dono do petshop; conta do colaborador bloqueada."
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-[#9A3825]">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            Voltar
          </Button>
          <Button type="button" onClick={confirm} disabled={pending} className="bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : "Confirmar"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
