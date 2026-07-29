"use client";

import { useCallback, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import {
  PRODUCT_SELECT,
  RESERVATION_SELECT,
  reservationVisibilityFilter,
} from "@/lib/produtos";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { ReserveList, type ProductVariant } from "@/components/reserve-list";
import {
  MyReservations,
  isActiveReservation,
  type Reservation,
} from "@/components/my-reservations";
import { RejectionNotices } from "@/components/rejection-notice";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  stock: number;
  photo_path?: string | null;
  photos?: string[];
  product_variant?: ProductVariant[];
};


export function ProdutosView({
  initialProducts,
  initialReservations,
  tenantId,
  tutorId,
  reservado,
}: {
  initialProducts: Product[];
  initialReservations: Reservation[];
  tenantId: string;
  tutorId: string;
  reservado?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const fetchProducts = useCallback(async (): Promise<Product[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product")
      .select(PRODUCT_SELECT)
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .eq("for_sale", true)
      .order("name");
    return (data ?? []) as Product[];
  }, [tenantId]);

  const fetchReservations = useCallback(async (): Promise<Reservation[]> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("product_reservation")
      .select(RESERVATION_SELECT)
      .eq("tutor_id", tutorId)
      .or(reservationVisibilityFilter())
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as Reservation[];
  }, [tutorId]);

  const products = useRealtimeList(
    initialProducts,
    fetchProducts,
    [
      { table: "product", filter: `tenant_id=eq.${tenantId}` },
      { table: "product_variant", filter: `tenant_id=eq.${tenantId}` },
    ],
    `produtos-${tenantId}`,
  );

  const reservations = useRealtimeList(
    initialReservations,
    fetchReservations,
    [
      { table: "product_reservation", filter: `tenant_id=eq.${tenantId}` },
      { table: "product_reservation_item", filter: `tenant_id=eq.${tenantId}` },
    ],
    `reservas-${tutorId}`,
  );

  // As recusadas aparecem na lista, mas não contam como reserva em aberto.
  const activeCount = reservations.filter(isActiveReservation).length;
  // Dispensadas somem do aviso, mas seguem em "Minhas reservas" como histórico.
  const rejected = reservations.filter((r) => r.status === "REJECTED" && !r.rejection_seen_at);

  return (
    <div className="space-y-4">
      {reservado && activeCount > 0 && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-graphite">
          Reserva enviada! O petshop vai separar seus produtos.
        </div>
      )}

      {/* Mesmo aviso da home: recusa com motivo não pode ficar só atrás do
          botão de reservas, que mostra "(0)" quando nada está em aberto. */}
      <RejectionNotices reservations={rejected} />

      {activeCount > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <ShoppingBag className="h-4 w-4" />
            Minhas reservas ({activeCount})
          </Button>
        </div>
      )}

      <ReserveList products={products} />

      <Dialog open={open} onOpenChange={setOpen} title="Minhas reservas">
        <MyReservations reservations={reservations} />
      </Dialog>
    </div>
  );
}
