"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button, Dialog, Input, Label } from "@mylivepet/ui";
import {
  revokeCollaboratorAccess,
  setCollaboratorAccess,
  type FormState,
} from "@/app/(app)/colaboradores/actions";

export type CollaboratorAccess = {
  id: string;
  full_name: string;
  access_email: string | null;
  /** Preenchido quando o colaborador já criou a senha e entrou pela primeira vez. */
  has_login: boolean;
};

export function CollaboratorAccessDialog({
  collaborator,
}: {
  collaborator: CollaboratorAccess;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [setState, setAction, setPending] = useActionState<FormState, FormData>(
    setCollaboratorAccess,
    { ok: false },
  );
  const [revokeState, revokeAction, revokePending] = useActionState<FormState, FormData>(
    revokeCollaboratorAccess,
    { ok: false },
  );

  useEffect(() => {
    if (setState.ok || revokeState.ok) {
      setOpen(false);
      setConfirmingRevoke(false);
      router.refresh();
    }
  }, [setState, revokeState, router]);

  useEffect(() => {
    if (open) setConfirmingRevoke(false);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Acesso ao painel de ${collaborator.full_name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
      >
        <KeyRound className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Acesso ao painel"
        description={collaborator.full_name}
      >
        {collaborator.access_email && !confirmingRevoke ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-muted p-3">
              <p className="text-xs text-gray-neutral">E-mail de acesso</p>
              <p className="text-sm font-medium text-graphite">{collaborator.access_email}</p>
              <p className="mt-2 text-xs text-gray-neutral">
                {collaborator.has_login
                  ? "Senha já criada — o colaborador entra normalmente pelo painel."
                  : "Aguardando o primeiro acesso: peça para ele abrir o painel, digitar este e-mail e criar a senha."}
              </p>
            </div>

            <p className="text-sm text-graphite">
              O colaborador vê apenas os atendimentos atribuídos a ele e a ficha dos pets
              que atende. Não tem acesso a financeiro, produtos, tutores nem configurações.
            </p>

            {(setState.error ?? revokeState.error) && (
              <p className="text-sm text-danger">{setState.error ?? revokeState.error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="danger"
                onClick={() => setConfirmingRevoke(true)}
              >
                Revogar acesso
              </Button>
            </div>
          </div>
        ) : confirmingRevoke ? (
          <form action={revokeAction} className="space-y-4">
            <input type="hidden" name="id" value={collaborator.id} />
            <p className="text-sm text-graphite">
              O acesso será removido e a sessão dele encerrada. O cadastro do colaborador,
              os horários e os atendimentos continuam como estão — só o login é revogado.
            </p>
            {revokeState.error && <p className="text-sm text-danger">{revokeState.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmingRevoke(false)}
              >
                Voltar
              </Button>
              <Button type="submit" variant="danger" disabled={revokePending}>
                {revokePending ? "Revogando..." : "Revogar acesso"}
              </Button>
            </div>
          </form>
        ) : (
          <form action={setAction} className="space-y-4">
            <input type="hidden" name="id" value={collaborator.id} />
            <p className="text-sm text-graphite">
              Informe o e-mail que o colaborador vai usar para entrar. Ele cria a própria
              senha no primeiro acesso — você não precisa definir nenhuma senha aqui.
            </p>
            <div>
              <Label htmlFor={`access_email_${collaborator.id}`}>E-mail de acesso *</Label>
              <Input
                id={`access_email_${collaborator.id}`}
                name="access_email"
                type="email"
                required
                autoComplete="off"
                placeholder="ana@petshop.com.br"
              />
            </div>
            {setState.error && <p className="text-sm text-danger">{setState.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={setPending}>
                {setPending ? "Salvando..." : "Criar acesso"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
