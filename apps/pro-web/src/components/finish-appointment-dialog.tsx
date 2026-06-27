"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Dialog, Label, PhotoGalleryInput } from "@mylivepet/ui";
import { finishAppointment } from "@/app/(app)/atendimentos/[id]/actions";

export function FinishAppointmentDialog({ appointmentId }: { appointmentId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full">
        <CheckCircle2 className="h-4 w-4" /> Finalizar atendimento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Finalizar atendimento"
        description="Registre fotos do pet e como ele se comportou. Tudo opcional."
      >
        <form action={finishAppointment} className="space-y-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="appointment_id" value={appointmentId} />

          <div>
            <Label>Fotos do pet (até 5)</Label>
            <PhotoGalleryInput name="photos" max={5} capture="environment" />
          </div>

          <div>
            <Label htmlFor="behavior">Como o pet se comportou?</Label>
            <textarea
              id="behavior"
              name="behavior"
              rows={3}
              className="w-full rounded-xl border border-graphite/15 bg-surface p-3 text-sm text-graphite placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange"
              placeholder="Ex.: comportou-se muito bem, ficou tranquilo no banho."
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Concluir atendimento</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
