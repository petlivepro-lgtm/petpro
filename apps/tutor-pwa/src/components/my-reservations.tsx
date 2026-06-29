"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Button, ConfirmDialog } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { cancelReservation, cancelReservationItem } from "@/app/(app)/actions";

type ReservationItem = {
  id: string;
  quantity: number;
  price_cents: number;
  product: { name: string; photo_path: string | null } | null;
};

export type Reservation = {
  id: string;
  note: string | null;
  expires_at: string | null;
  created_at: string;
  product_reservation_item: ReservationItem[];
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
        return (
          <div key={r.id} className="rounded-2xl border border-graphite/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                Reservado
              </span>
              {expires && (
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
                        alt={item.product?.name ?? "Produto"}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-graphite">
                      {item.product?.name ?? "Produto"}
                    </p>
                    <p className="text-xs text-gray-neutral">
                      {item.quantity}x {formatBRL(item.price_cents)}
                    </p>
                  </div>
                  <CancelActionButton
                    action={cancelReservationItem}
                    hidden={{ item_id: item.id }}
                    triggerLabel="Remover"
                    triggerVariant="ghost"
                    title="Remover item?"
                    description="O estoque deste item será devolvido."
                    confirmLabel="Remover"
                  />
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-graphite/5 pt-3">
              <p className="text-sm font-medium text-graphite">Total: {formatBRL(total)}</p>
              <CancelActionButton
                action={cancelReservation}
                hidden={{ reservation_id: r.id }}
                triggerLabel="Cancelar reserva"
                triggerVariant="danger"
                title="Cancelar reserva?"
                description="Toda a reserva será cancelada e o estoque devolvido."
                confirmLabel="Sim, cancelar"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
