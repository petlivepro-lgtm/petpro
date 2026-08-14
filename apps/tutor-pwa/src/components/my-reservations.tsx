"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Button, ConfirmDialog, StatusChip } from "@mylivepet/ui";
import { formatBRL, RESERVATION_STATUS_LABEL, type ReservationStatus } from "@mylivepet/types";
import { cancelReservation, cancelReservationItem } from "@/app/(app)/actions";

type ReservationItem = {
  id: string;
  quantity: number;
  price_cents: number;
  variant_label: string | null;
  /** Snapshot (0037): o produto pode ter saído do catálogo depois da reserva. */
  product_name: string | null;
  product: { name: string; photo_path: string | null } | null;
};

export type Reservation = {
  id: string;
  status: ReservationStatus;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  /** Instante em que o tutor dispensou o aviso de recusa (0024). */
  rejection_seen_at: string | null;
  product_reservation_item: ReservationItem[];
};

/** Reservas em que o tutor ainda pode mexer (e que contam no badge do topo). */
export function isActiveReservation(r: { status: ReservationStatus }): boolean {
  return r.status === "RESERVED" || r.status === "PICKED";
}

const TONE: Partial<Record<ReservationStatus, React.ComponentProps<typeof StatusChip>["tone"]>> = {
  RESERVED: "success",
  PICKED: "info",
  REJECTED: "danger",
};

function fmtExpires(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Botão que confirma uma ação de cancelamento via popup (ConfirmDialog) e, ao
 * confirmar, envia o server action que o envolve (confirmType="submit").
 */
function CancelActionButton({
  action,
  hidden,
  triggerLabel,
  triggerVariant,
  title,
  description,
  confirmLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  triggerLabel: string;
  triggerVariant: "ghost" | "danger";
  title: string;
  description: string;
  confirmLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <form action={action}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="button" size="sm" variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel="Voltar"
        confirmVariant="danger"
        confirmType="submit"
      />
    </form>
  );
}

export function MyReservations({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-gray-neutral">
          <Package className="h-6 w-6" />
        </span>
        <p className="text-sm text-gray-neutral">Você ainda não tem reservas ativas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reservations.map((r) => {
        const items = r.product_reservation_item;
        const total = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0);
        const expires = fmtExpires(r.expires_at);
        // Recusada pelo petshop: vira histórico com o motivo, sem ações.
        const rejected = r.status === "REJECTED";
        return (
          <div
            key={r.id}
            className={`rounded-2xl border p-4 ${
              rejected ? "border-danger/25 bg-danger/5" : "border-graphite/10"
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <StatusChip tone={TONE[r.status] ?? "neutral"}>
                {RESERVATION_STATUS_LABEL[r.status]}
              </StatusChip>
              {rejected
                ? r.rejected_at && (
                    <span className="text-xs text-gray-neutral">
                      {fmtExpires(r.rejected_at)}
                    </span>
                  )
                : expires && (
                    <span className="text-xs text-gray-neutral">Retirar até {expires}</span>
                  )}
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/50">
                    {item.product?.photo_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product.photo_path}
                        alt={item.product?.name ?? item.product_name ?? "Produto"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-graphite">
                      {item.product?.name ?? item.product_name ?? "Produto"}
                    </p>
                    {item.variant_label && (
                      <p className="truncate text-xs text-gray-neutral">{item.variant_label}</p>
                    )}
                    <p className="text-xs text-gray-neutral">
                      {item.quantity}x {formatBRL(item.price_cents)}
                    </p>
                  </div>
                  {r.status === "RESERVED" && (
                    <CancelActionButton
                      action={cancelReservationItem}
                      hidden={{ item_id: item.id }}
                      triggerLabel="Remover"
                      triggerVariant="ghost"
                      title="Remover item?"
                      description="O estoque deste item será devolvido."
                      confirmLabel="Remover"
                    />
                  )}
                </div>
              ))}
            </div>

            {rejected && r.rejection_reason && (
              <div className="mt-3 rounded-xl bg-surface p-3">
                <p className="text-xs font-medium text-graphite">Motivo do petshop</p>
                <p className="mt-1 text-sm italic text-gray-neutral">“{r.rejection_reason}”</p>
              </div>
            )}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-graphite/5 pt-3">
              <p className="text-sm font-medium text-graphite">Total: {formatBRL(total)}</p>
              {r.status === "RESERVED" && (
                <CancelActionButton
                  action={cancelReservation}
                  hidden={{ reservation_id: r.id }}
                  triggerLabel="Cancelar reserva"
                  triggerVariant="danger"
                  title="Cancelar reserva?"
                  description="Toda a reserva será cancelada e o estoque devolvido."
                  confirmLabel="Sim, cancelar"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
