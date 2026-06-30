import Link from "next/link";
import { Users, PawPrint, Phone, Mail, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, Avatar, EmptyState } from "@mylivepet/ui";
import { NewTutorDialog } from "@/components/new-tutor-dialog";
import { NewPetDialog } from "@/components/new-pet-dialog";
import { DeleteTutorDialog } from "@/components/delete-tutor-dialog";

export default async function TutoresPage() {
  const supabase = await createClient();
  const { data: tutores } = await supabase
    .from("tutor")
    .select("id, full_name, email, phone, profile_id, pet(id, name, species)")
    .order("full_name");

  const list = tutores ?? [];

  return (
    <div>
      <PageHeader
        title="Tutores & Pets"
        subtitle="Cadastro e histórico dos clientes."
        actions={<NewTutorDialog />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum tutor cadastrado ainda"
          description="Cadastre o primeiro cliente para começar a registrar pets e atendimentos."
          action={<NewTutorDialog trigger="cta" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((t) => {
            const pets = (t.pet as { id: string; name: string; species: string | null }[]) ?? [];
            return (
              <Card key={t.id}>
                <div className="flex items-start gap-3">
                  <Avatar name={t.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-base font-semibold text-graphite">{t.full_name}</p>
                      {t.profile_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                          <Smartphone className="h-3 w-3" /> App ativo
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5 text-sm text-gray-neutral">
                      {t.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" /> {t.phone}
                        </p>
                      )}
                      {t.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" /> {t.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DeleteTutorDialog tutorId={t.id} tutorName={t.full_name} hasAccess={!!t.profile_id} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-graphite/5 pt-4">
                  {pets.map((p) => (
                    <Link
                      key={p.id}
                      href={`/pets/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-sm text-graphite transition-colors hover:bg-orange/10 hover:text-orange"
                    >
                      <PawPrint className="h-3.5 w-3.5" /> {p.name}
                    </Link>
                  ))}
                  <NewPetDialog tutorId={t.id} tutorName={t.full_name} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
