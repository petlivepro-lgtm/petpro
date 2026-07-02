"use client";

import { useCallback, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Button, Dialog } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { ReserveList } from "@/components/reserve-list";
import { MyReservations, type Reservation } from "@/components/my-reservations";

type Product = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  price_cents: number;
  stock: number;
  photo_path?: string | null;
  photos?: string[];
};

const PRODUCT_SELECT = "id, name, description, category, price_cents, stock, photo_path, photos";
const RESERVATION_SELECT =
  "id, note, expires_at, created_at, product_reservation_item(id, quantity, price_cents, product:product_id(name, photo_path))";

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
      .eq("status", "RESERVED")
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as Reservation[];
  }, [tutorId]);

  const products = useRealtimeList(
    initialProducts,
    fetchProducts,
    [{ table: "product", filter: `tenant_id=eq.${tenantId}` }],
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

  return (
    <div className="space-y-4">
      {reservado && reservations.length > 0 && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-graphite">
          Reserva enviada! O petshop vai separar seus produtos.
        </div>
      )}

      {reservations.length > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <ShoppingBag className="h-4 w-4" />
            Minhas reservas ({reservations.length})
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
