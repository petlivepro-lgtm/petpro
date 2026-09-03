"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Undo2 } from "lucide-react";
import { Button, Dialog, cn } from "@mylivepet/ui";
import { formatUsageMoment, type ClubinhoUsageDTO } from "@mylivepet/types";
import {
  undoClubinhoUsage,
  type FormState,
} from "@/app/(app)/clubinho/actions";

/**
 * Os serviços do ciclo marcados como já realizados na mão.
 *
 * Só as baixas manuais aparecem aqui — a entrega que veio de atendimento já
 * está na agenda e no histórico do pet, e repeti-la seria contar duas vezes.
 *
 * Mesma anatomia do bloco de horário fixo (título, botão à direita, lista
 * embaixo) para o cartão não ganhar uma terceira gramática.
 */
export function ClubinhoUsageList({
  usages,
  petId,
  canManage,
  className,
  children,
}: {
  usages: ClubinhoUsageDTO[];
  petId: string;
  canManage: boolean;
  className?: string;
  /** O botão de marcar, montado pela página (server component). */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-graphite">
          <CircleCheckBig className="h-4 w-4 text-petrol" /> Serviços já
          realizados
        </p>
        {canManage && children}
      </div>

      {usages.length === 0 ? (
        <p className="text-sm text-gray-neutral">
          Nenhum serviço marcado na mão neste ciclo. Use quando o pet já era do
          Clubinho antes do sistema, ou quando o serviço saiu sem passar pela
          agenda.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {usages.map((usage) => (
            <li
              key={usage.id}
              className="flex items-center gap-2 rounded-xl border border-graphite/10 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-graphite">
                  {usage.service_name} · {formatUsageMoment(usage.used_at)}
                </p>
                <p className="truncate text-xs text-gray-neutral">
                  {usage.note ?? "Descontado do saldo sem gerar atendimento"}
                </p>
              </div>
              {canManage && <UndoUsageButton usage={usage} petId={petId} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UndoUsageButton({
  usage,
  petId,
}: {
  usage: ClubinhoUsageDTO;
  petId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    undoClubinhoUsage,
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
        aria-label={`Desfazer ${usage.service_name} de ${formatUsageMoment(usage.used_at)}`}
        title="Desfazer — devolve o serviço para o saldo"
        className="shrink-0 rounded-lg p-1.5 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Undo2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Desfazer esta baixa?"
        description={`${usage.service_name} · ${formatUsageMoment(usage.used_at)}`}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={usage.id} />
          <input type="hidden" name="pet_id" value={petId} />

          <p className="text-sm text-graphite">
            O serviço volta para o saldo do ciclo.
          </p>
          <p className="text-sm text-gray-neutral">
            Só baixas manuais são desfeitas aqui. O que foi entregue num
            atendimento volta pelo estorno do atendimento, como já funciona
            hoje.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Desfazendo..." : "Desfazer"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
