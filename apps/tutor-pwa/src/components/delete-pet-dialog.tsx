"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deletePet, type FormState } from "@/app/(app)/meus-pets/actions";

/**
 * Remove um pet do cadastro do tutor.
 *
 * O diálogo distingue dois casos, porque a resposta muda: pet recém-cadastrado
 * sai sem cerimônia; pet que já foi ao petshop não sai, e a tela diz por quê em
 * vez de deixar o tutor apertar e tomar um erro do banco. Quem decide de fato é
 * o trigger pet_delete_guard (0051) — aqui é só a versão legível.
 */
export function DeletePetDialog({
  petId,
  petName,
  appointmentCount,
  hasClubinho,
}: {
  petId: string;
  petName: string;
  appointmentCount: number;
  hasClubinho: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deletePet,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    router.refresh();
  }, [state.ok, router]);

  const blockedByHistory = appointmentCount > 0;
  const blocked = blockedByHistory || hasClubinho;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${petName}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir pet?"
        description={petName}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={petId} />

          {blockedByHistory ? (
            <>
              <p className="text-sm text-graphite">
                {petName} já tem {appointmentCount} atendimento
                {appointmentCount > 1 ? "s" : ""} registrado
                {appointmentCount > 1 ? "s" : ""} no petshop.
              </p>
              <p className="text-sm text-gray-neutral">
                Esse histórico — com as fotos e os boletins de comportamento —
                também é o registro de trabalho de quem atendeu, então a
                exclusão passa a ser do petshop. Fale com eles e a ficha é
                removida por lá.
              </p>
            </>
          ) : hasClubinho ? (
            <>
              <p className="text-sm text-graphite">
                {petName} tem uma assinatura do Clubinho aberta.
              </p>
              <p className="text-sm text-gray-neutral">
                Cancele a assinatura com o petshop antes de excluir — assim
                ninguém perde de vista o saldo que ainda restava no ciclo.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-graphite">
                Isso remove {petName} do seu cadastro. Ele deixa de aparecer
                para agendar e some da lista que o petshop enxerga.
              </p>
              <p className="text-sm font-medium text-danger">
                Esta ação não pode ser desfeita.
              </p>
            </>
          )}

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              {blocked ? "Entendi" : "Cancelar"}
            </Button>
            {!blocked && (
              <Button type="submit" variant="danger" disabled={pending}>
                {pending ? "Excluindo..." : "Excluir pet"}
              </Button>
            )}
          </div>
        </form>
      </Dialog>
    </>
  );
}
