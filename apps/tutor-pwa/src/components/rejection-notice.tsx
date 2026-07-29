"use client";

import { useState } from "react";
import Link from "next/link";
import { PackageX, X } from "lucide-react";
import { markRejectionSeen } from "@/app/(app)/actions";

export type RejectionNotice = {
  id: string;
  rejection_reason: string | null;
  rejected_at: string | null;
  product_reservation_item: {
    id: string;
    quantity: number;
    variant_label: string | null;
    product: { name: string } | null;
  }[];
};

function formatDate(v: string | null) {
  if (!v) return null;
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Aviso das reservas recusadas pelo petshop, com o motivo escrito por ele.
 * Dispensar grava `rejection_seen_at` no banco (RPC mark_rejection_seen), então
 * o aviso não volta em outro aparelho. A reserva recusada continua consultável
 * em Produtos › Minhas reservas enquanto estiver na janela de 7 dias.
 */
export function RejectionNotices({ reservations }: { reservations: RejectionNotice[] }) {
  // Some da tela na hora do clique; a action confirma no servidor em seguida.
  const [hidden, setHidden] = useState<string[]>([]);

  const visible = reservations.filter((r) => !hidden.includes(r.id));
  if (visible.length === 0) return null;

  return (
    <section className="space-y-3" aria-label="Avisos do petshop">
      {visible.map((r) => {
        const items = r.product_reservation_item ?? [];
        const when = formatDate(r.rejected_at);
        return (
          <div
            key={r.id}
            className="rounded-2xl border border-danger/30 bg-danger/5 p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                <PackageX className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold text-graphite">
                  O petshop recusou sua reserva
                </p>
                {when && <p className="mt-0.5 text-xs text-gray-neutral">{when}</p>}

                <ul className="mt-2 space-y-0.5 text-sm text-graphite">
                  {items.map((i) => (
                    <li key={i.id}>
                      {i.quantity} × {i.product?.name ?? "Produto"}
                      {i.variant_label && (
                        <span className="text-gray-neutral"> ({i.variant_label})</span>
                      )}
                    </li>
                  ))}
                </ul>

                {r.rejection_reason && (
                  <div className="mt-2 rounded-xl bg-surface p-3">
                    <p className="text-xs font-medium text-graphite">Motivo</p>
                    <p className="mt-1 text-sm italic text-gray-neutral">“{r.rejection_reason}”</p>
                  </div>
                )}

                <Link
                  href="/produtos"
                  className="mt-3 inline-block text-sm font-medium text-petrol underline-offset-2 hover:underline"
                >
                  Ver produtos disponíveis
                </Link>
              </div>

              <form action={markRejectionSeen} onSubmit={() => setHidden((h) => [...h, r.id])}>
                <input type="hidden" name="reservation_id" value={r.id} />
                <button
                  type="submit"
                  aria-label="Dispensar aviso"
                  className="rounded-lg p-1.5 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </section>
  );
}
