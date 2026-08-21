"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deleteClubinhoPlan, type FormState } from "./actions";

export function DeletePlanDialog({
  planId,
  name,
  subscriberCount,
}: {
  planId: string;
  name: string;
  subscriberCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deleteClubinhoPlan,
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir plano?"
        description={name}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={planId} />
          {subscriberCount > 0 ? (
            <p className="text-sm text-graphite">
              {subscriberCount} pet
              {subscriberCount > 1 ? "s assinam" : " assina"} este plano, então
              o banco vai recusar a exclusão. Para parar de vendê-lo sem mexer
              em quem já assina, desmarque{" "}
              <strong>Disponível para novas adesões</strong> na edição.
            </p>
          ) : (
            <p className="text-sm text-graphite">
              Ninguém assina este plano no momento. Se algum pet já assinou
              antes, mesmo com a assinatura cancelada, o banco recusa a exclusão
              para manter o histórico legível — nesse caso, desative.
            </p>
          )}

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
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
