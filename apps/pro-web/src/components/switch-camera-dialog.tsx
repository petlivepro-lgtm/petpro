"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Video } from "lucide-react";
import { Button, Dialog, Label, Select, type ButtonProps } from "@mylivepet/ui";
import {
  switchAppointmentCamera,
  type SwitchCameraState,
} from "@/app/(app)/atendimentos/[id]/actions";
import type { CameraOption } from "@/components/start-appointment-dialog";

/**
 * Troca a sala do atendimento em andamento — o pet sai do banho e vai para a
 * tosa. A transmissão do tutor acompanha sozinha (o app dele escuta o
 * appointment em tempo real e refaz o stream com a câmera nova).
 */
export function SwitchCameraDialog({
  appointmentId,
  cameras,
  currentCameraId,
  size,
  className = "w-full",
}: {
  appointmentId: string;
  cameras: CameraOption[];
  currentCameraId: string | null;
  size?: ButtonProps["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<SwitchCameraState, FormData>(
    switchAppointmentCamera,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  if (cameras.length === 0) return null;

  // Sem câmera ainda (iniciou sem transmissão), o mesmo dialog serve para ligar.
  const live = currentCameraId !== null;
  const label = live ? "Trocar sala" : "Ativar transmissão";

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="secondary"
        size={size}
        className={className}
      >
        {live ? <Repeat className="h-4 w-4" /> : <Video className="h-4 w-4" />} {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="O tutor passa a ver a nova sala na hora, e a gravação continua no mesmo atendimento."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="appointment_id" value={appointmentId} />

          <div>
            <Label htmlFor={`switch-camera-${appointmentId}`}>Câmera da sala</Label>
            <Select
              id={`switch-camera-${appointmentId}`}
              name="camera_id"
              defaultValue={currentCameraId ?? ""}
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.room_label}
                </option>
              ))}
              <option value="">Sem transmissão</option>
            </Select>
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Trocando..." : "Confirmar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
