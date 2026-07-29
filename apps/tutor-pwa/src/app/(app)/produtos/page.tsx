import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { ProdutosView } from "@/components/produtos-view";
import {
  PRODUCT_SELECT,
  RESERVATION_SELECT,
  reservationVisibilityFilter,
} from "@/lib/produtos";
import { type Reservation } from "@/components/my-reservations";

const ERROR_MESSAGES: Record<string, string> = {
  estoque: "Estoque insuficiente para um dos itens. Ajuste as quantidades e tente novamente.",
  variacao: "Escolha a cor, o tamanho ou o peso do produto antes de reservar.",
  "1": "Não foi possível enviar sua reserva. Tente novamente.",
};

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ reservado?: string; erro?: string }>;
}) {
  const { reservado, erro } = await searchParams;
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: products } = await supabase
    .from("product")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .eq("for_sale", true)
    .order("name");

  const { data: reservations } = await supabase
    .from("product_reservation")
    .select(RESERVATION_SELECT)
    .eq("tutor_id", ctx.tutorId)
    .or(reservationVisibilityFilter())
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite">Produtos</h1>
        <p className="text-sm text-gray-neutral">Reserve e pague na loja ao retirar.</p>
      </header>

      {erro && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-graphite">
          {ERROR_MESSAGES[erro] ?? ERROR_MESSAGES["1"]}
        </div>
      )}

      <ProdutosView
        initialProducts={products ?? []}
        initialReservations={(reservations ?? []) as unknown as Reservation[]}
        tenantId={ctx.tenantId}
        tutorId={ctx.tutorId}
        reservado={!!reservado}
      />
    </div>
  );
}
