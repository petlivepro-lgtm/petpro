"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deleteTutor, type FormState } from "@/app/(app)/tutores/actions";

export function DeleteTutorDialog({
  tutorId,
  tutorName,
  hasAccess,
}: {
  tutorId: string;
  tutorName: string;
  hasAccess: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(deleteTutor, { ok: false });

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
        aria-label={`Excluir ${tutorName}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Excluir tutor?" description={tutorName}>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="tutor_id" value={tutorId} />
          <p className="text-sm text-graphite">
            Isso remove permanentemente o cadastro, os pets, atendimentos, reservas e consentimentos
            deste tutor
            {hasAccess ? ", além do acesso dele ao app MyLivePet" : ""}. Esta ação não pode ser
            desfeita.
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
