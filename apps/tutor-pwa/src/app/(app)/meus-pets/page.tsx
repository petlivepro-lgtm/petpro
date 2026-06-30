import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Card } from "@mylivepet/ui";
import { PetDialog, type PetRow } from "@/components/pet-dialog";

const SIZE_LABEL: Record<string, string> = {
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
};

export default async function MeusPetsPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: pets } = await supabase
    .from("pet")
    .select("id, name, species, breed, size, birth_date, notes")
    .eq("tutor_id", ctx.tutorId)
    .order("name");

  const list = (pets ?? []) as PetRow[];

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
          <p className="text-sm text-gray-neutral">
            Cadastre seus pets — eles ficam disponíveis para agendar e visíveis ao petshop.
          </p>
        </div>
        <PetDialog />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <Card key={p.id} className="flex items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <div className="text-2xl">🐾</div>
              <p className="mt-1 font-heading font-semibold text-graphite">{p.name}</p>
              <p className="text-xs text-gray-neutral">
                {[p.species, p.breed, p.size ? SIZE_LABEL[p.size] : null]
                  .filter(Boolean)
                  .join(" · ") || "Pet"}
              </p>
            </div>
            <PetDialog pet={p} />
          </Card>
        ))}
      </div>

      {list.length === 0 && (
        <Card className="p-6 text-center text-sm text-gray-neutral">
          Você ainda não cadastrou nenhum pet. Use o botão “Cadastrar pet”.
        </Card>
      )}
    </div>
  );
}
