import Link from "next/link";
import {
  Users,
  Phone,
  Mail,
  Smartphone,
  Contact,
  Crown,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  PageHeader,
  Avatar,
  EmptyState,
  RatingStars,
  StatusChip,
} from "@mylivepet/ui";
import {
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  behaviorBadgeOf,
  formatBehaviorScore,
  formatCpfBR,
} from "@mylivepet/types";
import { NewTutorDialog } from "@/components/new-tutor-dialog";
import { NewPetDialog } from "@/components/new-pet-dialog";
import { DeleteTutorDialog } from "@/components/delete-tutor-dialog";
import { EditTutorDialog } from "@/components/edit-tutor-dialog";
import { fetchBehaviorSummaries } from "@/lib/behavior";

export default async function TutoresPage() {
  const supabase = await createClient();
  const { data: tutores } = await supabase
    .from("tutor")
    .select(
      "id, full_name, email, phone, cpf, notes, profile_id, clubinho, pet(id, name, species, breed, photo_path)",
    )
    .order("full_name");

  const list = tutores ?? [];

  // Média do boletim de cada pet numa query só (a view já agrega). O histórico
  // completo vive na ficha do pet.
  const summaries = await fetchBehaviorSummaries(
    supabase,
    list.flatMap((t) => ((t.pet as { id: string }[]) ?? []).map((p) => p.id)),
  );

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
            const pets =
              (t.pet as {
                id: string;
                name: string;
                species: string | null;
                breed: string | null;
                photo_path: string | null;
              }[]) ?? [];
            return (
              <Card key={t.id}>
                <div className="flex items-start gap-3">
                  <Avatar name={t.full_name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-heading text-base font-semibold text-graphite">
                        {t.full_name}
                      </p>
                      {t.profile_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
                          <Smartphone className="h-3 w-3" /> App ativo
                        </span>
                      )}
                      {t.clubinho && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-petrol/10 px-2 py-0.5 text-xs font-medium text-petrol">
                          <Crown className="h-3 w-3" /> Clubinho
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
                      {t.cpf && (
                        <p className="flex items-center gap-1.5">
                          <Contact className="h-3.5 w-3.5" />{" "}
                          {formatCpfBR(t.cpf)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <EditTutorDialog
                      tutor={{
                        id: t.id,
                        full_name: t.full_name,
                        email: t.email,
                        phone: t.phone,
                        cpf: t.cpf,
                        notes: t.notes,
                        clubinho: t.clubinho,
                      }}
                    />
                    <DeleteTutorDialog
                      tutorId={t.id}
                      tutorName={t.full_name}
                      hasAccess={!!t.profile_id}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-graphite/5 pt-4">
                  {pets.map((p) => {
                    const summary = summaries.get(p.id) ?? null;
                    const average = summary?.averageScore ?? null;
                    const count = summary?.reportCount ?? 0;
                    const badge = behaviorBadgeOf(average, count);

                    return (
                      <Link
                        key={p.id}
                        href={`/pets/${p.id}`}
                        className="flex items-center gap-3 rounded-xl border border-graphite/5 p-2.5 transition-colors hover:border-orange/40 hover:bg-orange/[0.02]"
                      >
                        <Avatar name={p.name} src={p.photo_path} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-graphite">
                            {p.name}
                          </p>
                          <p className="truncate text-xs text-gray-neutral">
                            {p.breed ?? p.species ?? "Pet"}
                          </p>
                        </div>
                        {average !== null ? (
                          <div className="flex shrink-0 items-center gap-2">
                            {badge && (
                              <StatusChip tone={BEHAVIOR_BADGE_TONE[badge]}>
                                {BEHAVIOR_BADGE_LABEL[badge]}
                              </StatusChip>
                            )}
                            <RatingStars value={Math.round(average)} size="sm" />
                            <span className="text-xs text-gray-neutral">
                              {formatBehaviorScore(average)}
                            </span>
                          </div>
                        ) : (
                          <span className="shrink-0 text-xs text-gray-neutral">
                            Sem boletim
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-neutral" />
                      </Link>
                    );
                  })}
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
