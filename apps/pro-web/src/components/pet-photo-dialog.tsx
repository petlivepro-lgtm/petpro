"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Button, Dialog, FileInput, Label } from "@mylivepet/ui";
import { updatePetPhoto, type FormState } from "@/app/(app)/pets/[petId]/actions";

export function PetPhotoDialog({
  petId,
  petName,
  photoPath,
}: {
  petId: string;
  petName: string;
  photoPath: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(updatePetPhoto, { ok: false });

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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-neutral transition-colors hover:text-orange"
      >
        <Camera className="h-4 w-4" /> {photoPath ? "Alterar foto" : "Adicionar foto"}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={photoPath ? "Alterar foto" : "Adicionar foto"}
        description={`Foto de ${petName}.`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="pet_id" value={petId} />
          <div>
            <Label htmlFor="photo">Foto</Label>
            <FileInput id="photo" name="photo" previewSrc={photoPath} />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
