import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { ProdutosView } from "@/components/produtos-view";
import { type Reservation } from "@/components/my-reservations";

const ERROR_MESSAGES: Record<string, string> = {
  estoque: "Estoque insuficiente para um dos itens. Ajuste as quantidades e tente novamente.",
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
    .select("id, name, description, category, price_cents, stock, photo_path, photos")
    .eq("tenant_id", ctx.tenantId)
    .eq("active", true)
    .eq("for_sale", true)
    .order("name");

  const { data: reservations } = await supabase
    .from("product_reservation")
    .select(
      "id, note, expires_at, created_at, product_reservation_item(id, quantity, price_cents, product:product_id(name, photo_path))",
    )
    .eq("tutor_id", ctx.tutorId)
    .eq("status", "RESERVED")
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
