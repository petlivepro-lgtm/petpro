"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, Input, Label, Button, Select, DatePicker } from "@mylivepet/ui";
import { SPECIES_OPTIONS } from "@mylivepet/types";
import { createPet, type FormState } from "@/app/(app)/tutores/actions";

export function NewPetDialog({ tutorId, tutorName }: { tutorId: string; tutorName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(createPet, { ok: false });

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
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-graphite/20 px-3 py-1 text-sm text-gray-neutral transition-colors hover:border-orange hover:text-orange"
      >
        <Plus className="h-3.5 w-3.5" /> Pet
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Novo pet" description={`Adicionar pet de ${tutorName}.`}>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tutor_id" value={tutorId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Nome do pet *</Label>
              <Input id="name" name="name" required placeholder="Ex.: Thor" />
            </div>
            <div>
              <Label htmlFor="size">Porte</Label>
              <Select id="size" name="size" defaultValue="">
                <option value="">—</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="species">Espécie</Label>
              <Select id="species" name="species" defaultValue="">
                <option value="">—</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="breed">Raça</Label>
              <Input id="breed" name="breed" placeholder="Opcional" />
            </div>
          </div>
          <div>
            <Label htmlFor="birth_date">Nascimento</Label>
            <DatePicker id="birth_date" name="birth_date" mode="date" />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar pet"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
