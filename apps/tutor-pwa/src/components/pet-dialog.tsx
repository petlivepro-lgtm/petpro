"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button, Dialog, FileInput, Input, Label, Select, DatePicker } from "@mylivepet/ui";
import { SPECIES_OPTIONS } from "@mylivepet/types";
import { createPet, updatePet, type FormState } from "@/app/(app)/meus-pets/actions";

export type PetRow = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  size: string | null;
  birth_date: string | null;
  notes: string | null;
  photo_path: string | null;
};

export function PetDialog({ pet }: { pet?: PetRow }) {
  const router = useRouter();
  const isEdit = !!pet;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updatePet : createPet,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${pet!.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Cadastrar pet
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar pet" : "Novo pet"}
        description="Esses dados ficam visíveis para o seu petshop."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={pet!.id} />}

          <div>
            <Label htmlFor="photo">Foto</Label>
            <FileInput id="photo" name="photo" previewSrc={pet?.photo_path} />
          </div>

          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" name="name" required defaultValue={pet?.name} placeholder="Ex.: Thor" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="species">Espécie</Label>
              <Select id="species" name="species" defaultValue={pet?.species ?? ""}>
                <option value="">—</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="size">Porte</Label>
              <Select id="size" name="size" defaultValue={pet?.size ?? ""}>
                <option value="">—</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="breed">Raça</Label>
              <Input id="breed" name="breed" defaultValue={pet?.breed ?? ""} placeholder="Opcional" />
            </div>
            <div>
              <Label htmlFor="birth_date">Nascimento</Label>
              <DatePicker id="birth_date" name="birth_date" mode="date" defaultValue={pet?.birth_date} />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" name="notes" defaultValue={pet?.notes ?? ""} placeholder="Ex.: fica ansioso com secador." />
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
