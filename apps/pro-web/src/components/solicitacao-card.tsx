"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Clock,
  CalendarClock,
  Package,
  HandCoins,
} from "lucide-react";
import {
  Button,
  Card,
  Avatar,
  Dialog,
  Label,
  StatusChip,
  Textarea,
} from "@mylivepet/ui";
import {
  formatBRL,
  type PaymentTerminalDTO,
  type ReservationStatus,
} from "@mylivepet/types";
import { ReservationStatusBadge } from "@/components/status-badge";
import { PaymentFields } from "@/components/payment-fields";
import {
  updateAppointmentStatus,
  updateAppointmentsStatus,
  confirmReservation,
  completeReservation,
  cancelReservationByStaff,
  rejectReservation,
  type FormState,
} from "@/app/(app)/actions";

export type SolicitacaoAppointment = {
  id: string;
  scheduled_at: string | null;
  notes: string | null;
  petName: string;
  serviceName: string;
  /** Adicionais escolhidos pelo tutor, somados ao serviço na conclusão (0056). */
  addons: { id: string; name: string; priceCents: number }[];
  collaboratorName: string | null;
  requestGroupId: string | null;
};

export type SolicitacaoReservationItem = {
  id: string;
  quantity: number;
  price_cents: number;
  productName: string;
  /** Variação escolhida pelo tutor ("Preto · M · 1 kg"); nula sem variações. */
  variantLabel: string | null;
};

export type SolicitacaoReservation = {
  id: string;
  status: ReservationStatus;
  note: string | null;
  expires_at: string | null;
  items: SolicitacaoReservationItem[];
};

export type SolicitacaoGroup = {
  tutorId: string;
  tutorName: string;
  appointments: SolicitacaoAppointment[];
  reservations: SolicitacaoReservation[];
};

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

type ApptRequest = {
  key: string;
  scheduled_at: string | null;
  petName: string;
  collaboratorName: string | null;
  items: SolicitacaoAppointment[];
};

// Agrupa os serviços de uma mesma solicitação (request_group_id). Agendamentos
// antigos sem grupo (null) ficam cada um em seu próprio "pedido".
function groupByRequest(appointments: SolicitacaoAppointment[]): ApptRequest[] {
  const map = new Map<string, ApptRequest>();
  for (const a of appointments) {
    const key = a.requestGroupId ?? `solo-${a.id}`;
    let req = map.get(key);
    if (!req) {
      req = {
        key,
        scheduled_at: a.scheduled_at,
        petName: a.petName,
        collaboratorName: a.collaboratorName,
        items: [],
      };
      map.set(key, req);
    }
    req.items.push(a);
  }
  return [...map.values()];
}

/**
 * Recusa de reserva: o motivo é obrigatório e vai para o tutor, então o botão
 * abre um diálogo em vez de submeter direto. Mesmo padrão de
 * useActionState + form dentro de Dialog usado no financeiro.
 */
function RejectReservationButton({
  reservationId,
  onDone,
}: {
  reservationId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    rejectReservation,
    {
      ok: false,
    },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      setReason("");
      onDone();
      router.refresh();
    }
  }, [state, router, onDone]);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        <X className="h-4 w-4" /> Recusar
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Recusar reserva"
        description="O motivo aparece para o tutor no app dele. O estoque volta para o catálogo."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reservation_id" value={reservationId} />

          <div>
            <Label htmlFor={`reason-${reservationId}`}>
              Motivo da recusa *
            </Label>
            <Textarea
              id={`reason-${reservationId}`}
              name="reason"
              required
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: O produto acabou no estoque físico, já pedimos reposição."
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={pending || reason.trim().length < 3}
            >
              {pending ? "Recusando..." : "Recusar reserva"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function CompleteReservationButton({
  reservationId,
  totalCents,
  terminals,
  onDone,
}: {
  reservationId: string;
  totalCents: number;
  terminals: PaymentTerminalDTO[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    completeReservation,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    onDone();
    router.refresh();
  }, [state.ok, router, onDone]);

  return (
    <>
      <Button size="sm" type="button" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" /> Retirado/Pago
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Concluir venda"
        description="Confirme a forma de pagamento para gerar a receita."
      >
        <form key={String(open)} action={formAction} className="space-y-4">
          <input type="hidden" name="reservation_id" value={reservationId} />
          <PaymentFields
            idPrefix={`reservation-${reservationId}`}
            terminals={terminals}
            amountCents={totalCents}
          />
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
              {pending ? "Concluindo..." : "Concluir venda"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function CancelReservationButton({
  reservationId,
  onDone,
}: {
  reservationId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    cancelReservationByStaff,
    { ok: false },
  );

  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    onDone();
    router.refresh();
  }, [state.ok, router, onDone]);

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        type="button"
        onClick={() => setOpen(true)}
      >
        <X className="h-4 w-4" /> Cancelar
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Cancelar reserva"
        description="Os itens voltarão ao estoque e nenhuma receita será criada."
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reservation_id" value={reservationId} />
          <div>
            <Label htmlFor={`cancel-reservation-${reservationId}`}>
              Motivo *
            </Label>
            <Textarea
              id={`cancel-reservation-${reservationId}`}
              name="reason"
              minLength={3}
              maxLength={500}
              rows={3}
              required
              placeholder="Ex.: cliente desistiu antes do pagamento"
            />
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Voltar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function SolicitacaoCard({
  group,
  terminals,
}: {
  group: SolicitacaoGroup;
  terminals: PaymentTerminalDTO[];
}) {
  const [open, setOpen] = useState(false);
  const apptCount = group.appointments.length;
  const resvCount = group.reservations.length;
  const itemCount = group.reservations.reduce(
    (sum, r) => sum + r.items.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={group.tutorName} />
          <div>
            <p className="font-heading font-semibold text-graphite">
              {group.tutorName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-neutral">
              {apptCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {apptCount} agendamento{apptCount > 1 ? "s" : ""}
                </span>
              )}
              {resvCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" />
                  {itemCount} produto{itemCount > 1 ? "s" : ""} reservado
                  {itemCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Ver detalhes
        </Button>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={group.tutorName}
        description="Confirme o agendamento e os produtos reservados deste tutor."
      >
        <div className="space-y-6">
          {apptCount > 0 && (
            <section className="space-y-3">
              <h3 className="font-heading text-sm font-semibold text-graphite">
                Agendamentos
              </h3>
              {groupByRequest(group.appointments).map((req) => (
                <div
                  key={req.key}
                  className="rounded-xl border border-graphite/10 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-graphite">{req.petName}</p>
                    <StatusChip tone="warning">
                      <Clock className="h-3 w-3" />{" "}
                      {formatDate(req.scheduled_at)}
                    </StatusChip>
                  </div>
                  {req.collaboratorName && (
                    <p className="mt-1 text-sm text-gray-neutral">
                      com {req.collaboratorName}
                    </p>
                  )}
                  {req.items[0]?.notes && (
                    <p className="mt-1.5 text-sm italic text-gray-neutral">
                      “{req.items[0].notes}”
                    </p>
                  )}

                  {/* Ações em lote: confirmar/recusar todos os serviços do pedido. */}
                  {req.items.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-b border-graphite/10 pb-3">
                      <form
                        action={updateAppointmentsStatus}
                        onSubmit={() => setOpen(false)}
                      >
                        {req.items.map((a) => (
                          <input
                            key={a.id}
                            type="hidden"
                            name="appointment_ids"
                            value={a.id}
                          />
                        ))}
                        <input type="hidden" name="status" value="CONFIRMED" />
                        <Button size="sm" type="submit">
                          <Check className="h-4 w-4" /> Confirmar tudo
                        </Button>
                      </form>
                      <form
                        action={updateAppointmentsStatus}
                        onSubmit={() => setOpen(false)}
                      >
                        {req.items.map((a) => (
                          <input
                            key={a.id}
                            type="hidden"
                            name="appointment_ids"
                            value={a.id}
                          />
                        ))}
                        <input type="hidden" name="status" value="REJECTED" />
                        <Button size="sm" variant="secondary" type="submit">
                          <X className="h-4 w-4" /> Recusar tudo
                        </Button>
                      </form>
                    </div>
                  )}

                  {/* Cada serviço com confirmação/recusa individual. */}
                  <ul className="mt-3 space-y-2">
                    {req.items.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="text-sm text-graphite">
                          {a.serviceName}
                          {a.addons.length > 0 && (
                            <span className="block text-xs text-gray-neutral">
                              {a.addons
                                .map(
                                  (addon) =>
                                    `+ ${addon.name} (${formatBRL(addon.priceCents)})`,
                                )
                                .join(" · ")}
                            </span>
                          )}
                        </span>
                        <div className="flex gap-2">
                          <form
                            action={updateAppointmentStatus}
                            onSubmit={() => setOpen(false)}
                          >
                            <input
                              type="hidden"
                              name="appointment_id"
                              value={a.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="CONFIRMED"
                            />
                            <Button size="sm" type="submit">
                              <Check className="h-4 w-4" /> Confirmar
                            </Button>
                          </form>
                          <form
                            action={updateAppointmentStatus}
                            onSubmit={() => setOpen(false)}
                          >
                            <input
                              type="hidden"
                              name="appointment_id"
                              value={a.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="REJECTED"
                            />
                            <Button size="sm" variant="secondary" type="submit">
                              <X className="h-4 w-4" /> Recusar
                            </Button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}

          {resvCount > 0 && (
            <section className="space-y-3">
              <h3 className="font-heading text-sm font-semibold text-graphite">
                Produtos reservados
              </h3>
              {group.reservations.map((r) => {
                const total = r.items.reduce(
                  (s, i) => s + i.price_cents * i.quantity,
                  0,
                );
                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-graphite/10 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <ReservationStatusBadge status={r.status} />
                      {r.status === "RESERVED" && r.expires_at && (
                        <span className="text-xs text-gray-neutral">
                          expira {formatDate(r.expires_at)}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1 text-sm text-graphite">
                      {r.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3">
                          <span>
                            {i.quantity} × {i.productName}
                            {i.variantLabel && (
                              <span className="text-gray-neutral">
                                {" "}
                                ({i.variantLabel})
                              </span>
                            )}
                          </span>
                          <span className="text-gray-neutral">
                            {formatPrice(i.price_cents * i.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex justify-between border-t border-graphite/10 pt-2 text-sm font-medium text-graphite">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                    {r.note && (
                      <p className="mt-2 text-sm italic text-gray-neutral">
                        “{r.note}”
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {r.status === "RESERVED" ? (
                        <>
                          <form
                            action={confirmReservation}
                            onSubmit={() => setOpen(false)}
                          >
                            <input
                              type="hidden"
                              name="reservation_id"
                              value={r.id}
                            />
                            <Button size="sm" type="submit">
                              <Check className="h-4 w-4" /> Confirmar reserva
                            </Button>
                          </form>
                          <RejectReservationButton
                            reservationId={r.id}
                            onDone={() => setOpen(false)}
                          />
                        </>
                      ) : r.status === "PICKED" ? (
                        <>
                          <CompleteReservationButton
                            reservationId={r.id}
                            totalCents={total}
                            terminals={terminals}
                            onDone={() => setOpen(false)}
                          />
                          <CancelReservationButton
                            reservationId={r.id}
                            onDone={() => setOpen(false)}
                          />
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </Dialog>
    </>
  );
}
