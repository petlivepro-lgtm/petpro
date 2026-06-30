import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Card } from "@mylivepet/ui";
import { TutorProfileForm, type TutorProfile } from "@/components/tutor-profile-form";
import { PetDialog, type PetRow } from "@/components/pet-dialog";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: tutor }, { data: pets }] = await Promise.all([
    supabase.from("tutor").select("full_name, email, phone, notes").eq("id", ctx.tutorId).maybeSingle(),
    supabase
      .from("pet")
      .select("id, name, species, breed, size, birth_date, notes")
      .eq("tutor_id", ctx.tutorId)
      .order("name"),
  ]);

  const profile: TutorProfile = {
    full_name: tutor?.full_name ?? ctx.fullName,
    email: tutor?.email ?? "",
    phone: tutor?.phone ?? "",
    notes: tutor?.notes ?? "",
  };
  const list = (pets ?? []) as PetRow[];

  return (
    <div className="space-y-6 lg:max-w-2xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Configurações</h1>
        <p className="text-sm text-gray-neutral">Edite seus dados e os dados dos seus pets.</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold text-graphite">Meus dados</h2>
        <TutorProfileForm tutor={profile} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-base font-semibold text-graphite">Meus pets</h2>
          <PetDialog />
        </div>

        <div className="space-y-2">
          {list.map((p) => (
            <Card key={p.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium text-graphite">{p.name}</p>
                <p className="truncate text-xs text-gray-neutral">
                  {[p.species, p.breed].filter(Boolean).join(" · ") || "Pet"}
                </p>
              </div>
              <PetDialog pet={p} />
            </Card>
          ))}
          {list.length === 0 && (
            <p className="text-sm text-gray-neutral">
              Nenhum pet cadastrado.{" "}
              <Link href="/meus-pets" className="font-medium text-orange">
                Cadastrar
              </Link>
              .
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
