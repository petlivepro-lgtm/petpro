import { createClient } from "@/lib/supabase/server";
import { ReserveList } from "@/components/reserve-list";

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<{ reservado?: string }>;
}) {
  const { reservado } = await searchParams;
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("product")
    .select("id, name, description, price_cents, stock, photo_path, photos")
    .eq("active", true)
    .order("name");

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite">Produtos</h1>
        <p className="text-sm text-gray-neutral">Reserve e pague na loja ao retirar.</p>
      </header>

      {reservado && (
        <div className="rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-graphite">
          Reserva enviada! O petshop vai separar seus produtos.
        </div>
      )}

      <ReserveList products={products ?? []} />
    </div>
  );
}
