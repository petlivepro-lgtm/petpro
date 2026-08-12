import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { Avatar, Card, EmptyState, PageHeader } from "@mylivepet/ui";

/**
 * Lista de pets do colaborador: os que ele já atendeu ou vai atender.
 *
 * Lê a view collaborator_pet (0031) em vez da tabela `pet` porque ela traz o
 * nome do tutor sem expor telefone e e-mail — o colaborador não tem acesso à
 * tabela `tutor`. A view já se limita aos pets dele.
 *
 * Para os demais papéis a lista de pets vive dentro de /tutores, com o
 * cadastro completo.
 */
export default async function PetsPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (tenant && tenant.role !== "COLLABORATOR") redirect("/tutores");

  const { data } = await supabase
    .from("collaborator_pet")
    .select("id, name, species, breed, photo_path, tutor_name")
    .order("name");

  const pets = data ?? [];

  return (
    <div>
      <PageHeader
        title="Pets"
        subtitle="Os pets que você atende. Toque para ver a ficha completa."
      />

      {pets.length === 0 ? (
        <EmptyState
          icon={<PawPrint className="h-6 w-6" />}
          title="Nenhum pet por aqui ainda"
          description="Assim que um atendimento for atribuído a você, o pet aparece nesta lista."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pets.map((p) => (
            <Card key={p.id} className="p-0">
              <Link
                href={`/pets/${p.id}`}
                className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-orange/[0.03]"
              >
                <Avatar name={p.name ?? "Pet"} src={p.photo_path} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-graphite">{p.name}</p>
                  <p className="truncate text-xs text-gray-neutral">
                    {p.breed ?? p.species ?? "Pet"}
                    {p.tutor_name ? ` · ${p.tutor_name}` : ""}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-neutral" />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
