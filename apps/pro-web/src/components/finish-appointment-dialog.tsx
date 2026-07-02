"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Dialog, Label, PhotoGalleryInput, Textarea } from "@mylivepet/ui";
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
            <Textarea
              id="behavior"
              name="behavior"
              rows={3}
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
