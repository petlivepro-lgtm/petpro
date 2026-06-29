import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@mylivepet/ui";
import { ProductDialog, type ProductRow } from "@/components/product-dialog";
import { ProdutosGrid } from "@/components/produtos-grid";

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product")
    .select("id, name, description, price_cents, stock, active, photo_path, photos")
    .order("name");

  const list = (data ?? []) as ProductRow[];

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
        <ProdutosGrid initialProducts={list} />
      )}
    </div>
  );
}
