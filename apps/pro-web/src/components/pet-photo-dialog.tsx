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
      {/* Badge no canto do avatar — o pai precisa ser `relative`. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={photoPath ? "Alterar foto" : "Adicionar foto"}
        aria-label={`${photoPath ? "Alterar" : "Adicionar"} foto de ${petName}`}
        className="absolute -bottom-1 -right-1 rounded-full border border-graphite/10 bg-surface p-1.5 text-gray-neutral shadow-card transition-colors hover:bg-orange/10 hover:text-orange"
      >
        <Camera className="h-3.5 w-3.5" />
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
