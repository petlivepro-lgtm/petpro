"use client";

import { useState } from "react";
import { Play, Video } from "lucide-react";
import { Button, Dialog, Label, Select } from "@mylivepet/ui";
import { startAppointment } from "@/app/(app)/atendimentos/[id]/actions";

export type CameraOption = { id: string; room_label: string };

/**
 * Inicia o atendimento escolhendo a câmera da sala. Com a câmera escolhida,
 * o tutor do pet passa a assistir ao vivo no app até a finalização.
 * Sem câmeras cadastradas, vira um botão direto (sem dialog).
 */
export function StartAppointmentDialog({
  appointmentId,
  cameras,
}: {
  appointmentId: string;
  cameras: CameraOption[];
}) {
  const [open, setOpen] = useState(false);

  if (cameras.length === 0) {
    return (
      <form action={startAppointment}>
        <input type="hidden" name="appointment_id" value={appointmentId} />
        <Button type="submit" className="w-full">
          <Play className="h-4 w-4" /> Iniciar atendimento
        </Button>
      </form>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-full">
        <Play className="h-4 w-4" /> Iniciar atendimento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Iniciar atendimento"
        description="Escolha a sala para transmitir ao vivo para o tutor."
      >
        <form action={startAppointment} className="space-y-4" onSubmit={() => setOpen(false)}>
          <input type="hidden" name="appointment_id" value={appointmentId} />

          <div>
            <Label htmlFor="camera_id">Câmera da sala</Label>
            <Select id="camera_id" name="camera_id" defaultValue={cameras[0]?.id}>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room_label}
                </option>
              ))}
              <option value="">Sem transmissão</option>
            </Select>
          </div>

          <p className="flex items-start gap-2 text-xs text-gray-neutral">
            <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Somente o tutor deste pet vê a transmissão, enquanto o atendimento estiver em
            andamento. A gravação fica disponível para ele depois, pelo prazo configurado.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              <Play className="h-4 w-4" /> Iniciar
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
