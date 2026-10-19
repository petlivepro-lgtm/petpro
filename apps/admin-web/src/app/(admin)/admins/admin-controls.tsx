"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button, Dialog, Input, Label, Select, Textarea } from "@mylivepet/ui";
import { ROLE_LABEL, type AdminRole } from "@/lib/roles";
import { useStepUp } from "@/components/step-up";
import { cancelInvite, inviteAdmin, revokeAdminSessions, setAdminStatus } from "./actions";

const petrol = "bg-petrol hover:bg-petrol/90 focus-visible:ring-petrol";

export function InviteButton({ roles }: { roles: AdminRole[] }) {
  const router = useRouter();
  const { run, dialog } = useStepUp();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(roles[roles.length - 1] ?? "suporte");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setEmail("");
      setReason("");
      setError(null);
      setDone(null);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    start(() =>
      run(
        () => inviteAdmin({ email, role, reason }),
        (res) => {
          if (res.ok) {
            setDone(res.data);
            router.refresh();
          } else setError(res.error);
        },
      ),
    );
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className="font-bold">
        <Plus className="h-4 w-4" aria-hidden /> Convidar administrador
      </Button>
      <Dialog
        open={open}
        onOpenChange={reset}
        title="Convidar administrador"
        description="A pessoa recebe um link que vale 24 horas e só funciona uma vez. No primeiro acesso ela cria uma senha nova e liga o app autenticador."
      >
        {done ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-[#22603F]">
              {done}
            </p>
            <Button type="button" variant="secondary" onClick={() => reset(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="inv-email">E-mail</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="focus-visible:ring-petrol" />
            </div>
            <div>
              <Label htmlFor="inv-role">Papel</Label>
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-gray-neutral">Só aparecem papéis abaixo do seu.</p>
            </div>
            <div>
              <Label htmlFor="inv-reason">Motivo</Label>
              <Input id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Ex.: atendimento aos petshops do Sul" className="focus-visible:ring-petrol" />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-[#9A3825]">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => reset(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending || !email || reason.trim().length < 10} className={petrol}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Enviando" /> : "Enviar convite"}
              </Button>
            </div>
          </form>
        )}
      </Dialog>
      {dialog}
    </>
  );
}

export function AdminRowActions({
  userId,
  status,
  isSelf,
  canManage,
}: {
  userId: string;
  status: string;
  isSelf: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const { run, dialog } = useStepUp();
  const [reasonFor, setReasonFor] = useState<"suspended" | "active" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canManage) return null;

  function revoke() {
    setError(null);
    start(() =>
      run(
        () => revokeAdminSessions(userId),
        (res) => (res.ok ? router.refresh() : setError(res.error)),
      ),
    );
  }

  function changeStatus(event: React.FormEvent) {
    event.preventDefault();
    if (!reasonFor) return;
    const target = reasonFor;
    setError(null);
    start(() =>
      run(
        () => setAdminStatus(userId, target, reason),
        (res) => {
          if (res.ok) {
            setReasonFor(null);
            setReason("");
            router.refresh();
          } else setError(res.error);
        },
      ),
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {status === "active" && (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={revoke}>
          Revogar sessões
        </Button>
      )}
      {!isSelf && status === "active" && (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setReasonFor("suspended")} className="text-[#9A3825]">
          Suspender
        </Button>
      )}
      {!isSelf && status === "suspended" && (
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => setReasonFor("active")}>
          Reativar
        </Button>
      )}
      {error && !reasonFor && (
        <p role="alert" className="w-full text-right text-xs font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      <Dialog
        open={reasonFor !== null}
        onOpenChange={(next) => {
          if (!next) {
            setReasonFor(null);
            setReason("");
            setError(null);
          }
        }}
        title={reasonFor === "suspended" ? "Suspender acesso" : "Reativar acesso"}
        description={
          reasonFor === "suspended"
            ? "Todas as sessões desta pessoa caem na hora. O motivo fica na auditoria."
            : "A pessoa volta a entrar com a senha e o app autenticador dela."
        }
      >
        <form onSubmit={changeStatus} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="status-reason">Motivo</Label>
            <Textarea id="status-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="focus-visible:ring-petrol" />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-[#9A3825]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReasonFor(null)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={pending || reason.trim().length < 10}
              variant={reasonFor === "suspended" ? "danger" : "primary"}
              className={reasonFor === "suspended" ? undefined : petrol}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : reasonFor === "suspended" ? "Suspender" : "Reativar"}
            </Button>
          </div>
        </form>
      </Dialog>
      {dialog}
    </div>
  );
}

export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const { run, dialog } = useStepUp();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(() =>
            run(
              () => cancelInvite(inviteId),
              (res) => (res.ok ? router.refresh() : setError(res.error)),
            ),
          )
        }
      >
        {error ?? "Cancelar convite"}
      </Button>
      {dialog}
    </>
  );
}
