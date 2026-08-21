"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Button,
  DatePicker,
  Dialog,
  Input,
  Label,
  Select,
  Textarea,
} from "@mylivepet/ui";
import { SPECIES_OPTIONS } from "@mylivepet/types";
import { updatePet, type FormState } from "@/app/(app)/pets/[petId]/actions";

export function EditPetDialog({
  pet,
}: {
  pet: {
    id: string;
    tutor_id: string;
    name: string;
    species: string | null;
    breed: string | null;
    size: string | null;
    birth_date: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updatePet,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Editar pet"
        aria-label={`Editar ${pet.name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Editar pet"
        description={`Atualize o cadastro de ${pet.name}.`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="pet_id" value={pet.id} />
          <input type="hidden" name="tutor_id" value={pet.tutor_id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-pet-name">Nome do pet *</Label>
              <Input
                id="edit-pet-name"
                name="name"
                required
                defaultValue={pet.name}
                placeholder="Ex.: Thor"
              />
            </div>
            <div>
              <Label htmlFor="edit-pet-size">Porte</Label>
              <Select id="edit-pet-size" name="size" defaultValue={pet.size ?? ""}>
                <option value="">—</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-pet-species">Espécie</Label>
              <Select
                id="edit-pet-species"
                name="species"
                defaultValue={pet.species ?? ""}
              >
                <option value="">—</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-pet-breed">Raça</Label>
              <Input
                id="edit-pet-breed"
                name="breed"
                defaultValue={pet.breed ?? ""}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="edit-pet-birth-date">Nascimento</Label>
            <DatePicker
              id="edit-pet-birth-date"
              name="birth_date"
              mode="date"
              max="today"
              defaultValue={pet.birth_date}
            />
          </div>

          <div>
            <Label htmlFor="edit-pet-notes">Observações</Label>
            <Textarea
              id="edit-pet-notes"
              name="notes"
              rows={3}
              defaultValue={pet.notes ?? ""}
              placeholder="Ex.: fica ansioso com secador."
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
