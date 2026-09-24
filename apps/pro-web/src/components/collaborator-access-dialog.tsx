"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Button, Dialog, Input, Label, Select } from "@mylivepet/ui";
import {
  COLLABORATOR_ACCESS_ROLES,
  COLLABORATOR_ACCESS_ROLE_LABEL,
  DELIVERY_VEHICLES,
  DELIVERY_VEHICLE_LABEL,
  type CollaboratorAccessRole,
  type DeliveryVehicle,
} from "@mylivepet/types";
import {
  revokeCollaboratorAccess,
  setCollaboratorAccess,
  setCollaboratorVehicle,
  type FormState,
} from "@/app/(app)/colaboradores/actions";

export type CollaboratorAccess = {
  id: string;
  full_name: string;
  access_email: string | null;
  /** Qual painel ele abre: quem atende, ou quem busca e devolve o pet (0062). */
  access_role: CollaboratorAccessRole;
  /** Preenchido quando o colaborador já criou a senha e entrou pela primeira vez. */
  has_login: boolean;
  /** Com o que o entregador anda — o ícone dele no mapa (0067). */
  vehicle: DeliveryVehicle;
};

/** O que cada cargo enxerga — o texto que explica a escolha para quem convida. */
const O_QUE_VE: Record<CollaboratorAccessRole, string> = {
  COLLABORATOR:
    "Vê apenas os atendimentos atribuídos a ele e a ficha dos pets que atende. Não tem acesso a financeiro, produtos, tutores nem configurações.",
  DELIVERY:
    "Vê a rota de leva-e-traz do dia, com o endereço e o telefone dos tutores dessas paradas. Não tem acesso a financeiro, produtos, agenda nem configurações.",
};

export function CollaboratorAccessDialog({
  collaborator,
}: {
  collaborator: CollaboratorAccess;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [cargo, setCargo] = useState<CollaboratorAccessRole>(
    collaborator.access_role ?? "COLLABORATOR",
  );
  const [setState, setAction, setPending] = useActionState<FormState, FormData>(
    setCollaboratorAccess,
    { ok: false },
  );
  const [revokeState, revokeAction, revokePending] = useActionState<FormState, FormData>(
    revokeCollaboratorAccess,
    { ok: false },
  );
  const [vehicleState, vehicleAction, vehiclePending] = useActionState<FormState, FormData>(
    setCollaboratorVehicle,
    { ok: false },
  );
  const [veiculo, setVeiculo] = useState<DeliveryVehicle>(collaborator.vehicle);

  // Salvar o veículo não fecha o diálogo: é um ajuste dentro da tela de
  // acesso, e fechar esconderia a confirmação de que deu certo.
  useEffect(() => {
    if (vehicleState.ok) router.refresh();
  }, [vehicleState, router]);

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

            <div className="rounded-xl bg-surface-muted p-3">
              <p className="text-xs text-gray-neutral">Cargo de acesso</p>
              <p className="text-sm font-medium text-graphite">
                {COLLABORATOR_ACCESS_ROLE_LABEL[collaborator.access_role]}
              </p>
            </div>

            <p className="text-sm text-graphite">{O_QUE_VE[collaborator.access_role]}</p>

            {collaborator.access_role === "DELIVERY" && (
              <form action={vehicleAction} className="space-y-1.5">
                <input type="hidden" name="id" value={collaborator.id} />
                <Label htmlFor={`vehicle_${collaborator.id}`}>Veículo</Label>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Select
                      id={`vehicle_${collaborator.id}`}
                      name="vehicle"
                      value={veiculo}
                      onChange={(e) => setVeiculo(e.target.value as DeliveryVehicle)}
                    >
                      {DELIVERY_VEHICLES.map((v) => (
                        <option key={v} value={v}>
                          {DELIVERY_VEHICLE_LABEL[v]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={vehiclePending || veiculo === collaborator.vehicle}
                  >
                    {vehiclePending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
                <p className="text-xs text-gray-neutral">
                  É o ícone dele no mapa — o dele e o que o tutor acompanha.
                </p>
                {vehicleState.error && (
                  <p className="text-sm text-danger">{vehicleState.error}</p>
                )}
              </form>
            )}

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

            <div>
              <Label htmlFor={`access_role_${collaborator.id}`}>Cargo de acesso *</Label>
              <Select
                id={`access_role_${collaborator.id}`}
                name="access_role"
                value={cargo}
                onChange={(e) => setCargo(e.target.value as CollaboratorAccessRole)}
              >
                {COLLABORATOR_ACCESS_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {COLLABORATOR_ACCESS_ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs text-gray-neutral">{O_QUE_VE[cargo]}</p>
            </div>
            {cargo === "DELIVERY" && (
              <div>
                <Label htmlFor={`vehicle_new_${collaborator.id}`}>Veículo</Label>
                <Select
                  id={`vehicle_new_${collaborator.id}`}
                  name="vehicle"
                  value={veiculo}
                  onChange={(e) => setVeiculo(e.target.value as DeliveryVehicle)}
                >
                  {DELIVERY_VEHICLES.map((v) => (
                    <option key={v} value={v}>
                      {DELIVERY_VEHICLE_LABEL[v]}
                    </option>
                  ))}
                </Select>
                <p className="mt-1.5 text-xs text-gray-neutral">
                  É o ícone dele no mapa de entregas.
                </p>
              </div>
            )}
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
