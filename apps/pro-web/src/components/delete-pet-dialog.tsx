"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { deletePet, type FormState } from "@/app/(app)/tutores/actions";

export function DeletePetDialog({
  petId,
  petName,
  appointmentCount,
  behaviorReportCount,
  hasClubinho,
  inProgress,
}: {
  petId: string;
  petName: string;
  /** Atendimentos registrados — todos somem junto com o pet. */
  appointmentCount: number;
  /** Boletins de comportamento, que vivem pendurados nos atendimentos. */
  behaviorReportCount: number;
  /** Assinatura do Clubinho aberta (ativa ou pausada). */
  hasClubinho: boolean;
  /** Pet na loja agora: o banco recusa a exclusão (0051). */
  inProgress: boolean;
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
    // A ficha deixou de existir — ficar nela mostraria um 404.
    router.push("/tutores");
    router.refresh();
  }, [state.ok, router]);

  // O que vai junto, listado com o número na frente: "some o histórico" é
  // abstrato, "somem 14 atendimentos" faz a pessoa parar e pensar.
  const losses = [
    appointmentCount > 0 &&
      `${appointmentCount} atendimento${appointmentCount > 1 ? "s" : ""} do histórico, com fotos e checklist`,
    behaviorReportCount > 0 &&
      `${behaviorReportCount} boletim${behaviorReportCount > 1 ? "ns" : ""} de comportamento`,
    hasClubinho && "a assinatura do Clubinho, com o saldo do ciclo atual",
  ].filter((item): item is string => !!item);

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
          <input type="hidden" name="pet_id" value={petId} />

          {inProgress ? (
            <p className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-graphite">
              {petName} está em atendimento agora. Conclua ou cancele o
              atendimento antes de excluir — enquanto isso o banco recusa a
              exclusão.
            </p>
          ) : (
            <>
              <p className="text-sm text-graphite">
                Isso apaga permanentemente a ficha de {petName}
                {losses.length > 0 ? " e leva junto:" : "."}
              </p>

              {losses.length > 0 && (
                <ul className="space-y-1 rounded-xl bg-surface-muted p-3 text-sm text-graphite">
                  {losses.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-danger">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              <p className="text-sm text-gray-neutral">
                O financeiro não muda: as receitas já lançadas continuam no
                caixa e no fechamento do mês, apenas sem o vínculo com a ficha.
                {losses.length > 0 &&
                  " Se a ideia é só parar de atender este pet, editar a ficha preserva o histórico."}
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
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={pending || inProgress}
            >
              {pending ? "Excluindo..." : "Excluir pet"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
