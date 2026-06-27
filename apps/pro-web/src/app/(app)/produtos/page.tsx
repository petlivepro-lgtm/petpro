import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatusChip, EmptyState } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { ProductDialog } from "@/components/product-dialog";
import { DeleteProductDialog } from "@/components/delete-product-dialog";

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product")
    .select("id, name, description, price_cents, stock, active, photo_path, photos")
    .order("name");

  const list = data ?? [];

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Catálogo disponível para reserva no MyLivePet (pagamento na loja)."
        actions={<ProductDialog />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Nenhum produto cadastrado"
          description="Cadastre o primeiro produto para exibir no app dos tutores."
          action={<ProductDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Card key={p.id} className="flex flex-col">
              <div className="mb-3 flex h-28 items-center justify-center overflow-hidden rounded-xl bg-surface-muted text-gray-neutral/50">
                {p.photo_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_path} alt={p.name} className="h-full w-full object-cover" />
                ) : (
                  <Package className="h-8 w-8" />
                )}
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading font-semibold text-graphite">{p.name}</p>
                <StatusChip tone={p.stock > 0 ? "success" : "danger"}>
                  {p.stock > 0 ? `${p.stock} un.` : "Esgotado"}
                </StatusChip>
              </div>
              <p className="mt-2 font-heading text-xl font-bold text-graphite">
                {formatBRL(p.price_cents)}
              </p>
              <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
                {!p.active && <span className="text-xs text-gray-neutral">Inativo (oculto no app)</span>}
                <div className="ml-auto flex items-center gap-1">
                  <ProductDialog product={p} />
                  <DeleteProductDialog productId={p.id} productName={p.name} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
