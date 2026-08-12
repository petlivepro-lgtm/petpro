"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  Button,
  CpfInput,
  Dialog,
  Input,
  Label,
  PhoneInput,
} from "@mylivepet/ui";
import { updateTutor, type FormState } from "@/app/(app)/tutores/actions";

export function EditTutorDialog({
  tutor,
}: {
  tutor: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateTutor,
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
        aria-label={`Editar ${tutor.full_name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
      >
        <Pencil className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Editar tutor"
        description="Atualize os dados de contato e o CPF opcional."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tutor_id" value={tutor.id} />
          <div>
            <Label htmlFor={`edit-tutor-name-${tutor.id}`}>Nome *</Label>
            <Input
              id={`edit-tutor-name-${tutor.id}`}
              name="full_name"
              required
              defaultValue={tutor.full_name}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`edit-tutor-phone-${tutor.id}`}>Telefone</Label>
              <PhoneInput
                id={`edit-tutor-phone-${tutor.id}`}
                name="phone"
                defaultValue={tutor.phone ?? ""}
              />
            </div>
            <div>
              <Label htmlFor={`edit-tutor-email-${tutor.id}`}>E-mail</Label>
              <Input
                id={`edit-tutor-email-${tutor.id}`}
                name="email"
                type="email"
                defaultValue={tutor.email ?? ""}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`edit-tutor-cpf-${tutor.id}`}>CPF (opcional)</Label>
            <CpfInput
              id={`edit-tutor-cpf-${tutor.id}`}
              name="cpf"
              defaultValue={tutor.cpf ?? ""}
            />
          </div>
          <div>
            <Label htmlFor={`edit-tutor-notes-${tutor.id}`}>Observações</Label>
            <Input
              id={`edit-tutor-notes-${tutor.id}`}
              name="notes"
              defaultValue={tutor.notes ?? ""}
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
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
