"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deleteCamera, type FormState } from "./actions";

export function DeleteCameraDialog({
  cameraId,
  roomLabel,
}: {
  cameraId: string;
  roomLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteCamera, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir câmera de ${roomLabel}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Excluir câmera?" description={roomLabel}>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={cameraId} />
          <p className="text-sm text-graphite">
            A câmera e a credencial serão removidas. As gravações já feitas continuam
            disponíveis até expirarem. Para pausar temporariamente, desative-a em vez de
            excluir.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
