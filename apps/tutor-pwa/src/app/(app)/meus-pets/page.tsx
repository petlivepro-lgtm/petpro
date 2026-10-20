import Link from "next/link";
import { PawPrint } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { EmptyState } from "@mylivepet/ui";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import {
  loadMyClubinho,
  loadMyClubinhoSchedules,
  syncClubinhoPeriods,
} from "@/lib/clubinho";
import { PetDialog, type PetRow } from "@/components/pet-dialog";
import { MyPetCard, type PetActivity } from "@/components/my-pet-card";

const EMPTY_ACTIVITY: PetActivity = { total: 0, completed: 0, lastVisit: null, next: null };

export default async function MeusPetsPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: pets } = await supabase
    .from("pet")
    .select("id, name, species, breed, size, birth_date, notes, photo_path")
    .eq("tutor_id", ctx.tutorId)
    .order("name");

  const list = (pets ?? []) as PetRow[];

  // Renova os ciclos vencidos antes de ler o saldo — mesma rotina da home
  // (ver syncClubinhoPeriods).
  await syncClubinhoPeriods(supabase, ctx.tenantId);
  const [summaries, clubinho, { data: appts }] = await Promise.all([
    fetchBehaviorSummaries(
      supabase,
      list.map((p) => p.id),
    ),
    loadMyClubinho(supabase, ctx.tutorId),
    // Atendimentos de cada pet: o total decide se o tutor ainda pode excluir a
    // ficha sozinho (pet_delete_guard, 0051) — e o número aparece no aviso,
    // para "tem histórico" não soar arbitrário. Os mesmos dados dão a última
    // visita e o próximo horário do card.
    supabase
      .from("appointment")
      .select("pet_id, status, scheduled_at, finished_at, service_type(name)")
      .eq("tutor_id", ctx.tutorId),
  ]);
  const clubinhoByPet = new Map(clubinho.map((s) => [s.pet_id, s] as const));
  const schedulesBySubscription = await loadMyClubinhoSchedules(
    supabase,
    clubinho.map((s) => s.id),
  );

  const now = Date.now();
  const activity = new Map<string, PetActivity>();
  for (const row of appts ?? []) {
    const a = activity.get(row.pet_id) ?? { ...EMPTY_ACTIVITY };
    a.total += 1;
    if (row.status === "COMPLETED") {
      a.completed += 1;
      const at = row.finished_at ?? row.scheduled_at;
      if (at && (!a.lastVisit || at > a.lastVisit)) a.lastVisit = at;
    }
    if (
      (row.status === "REQUESTED" || row.status === "CONFIRMED") &&
      row.scheduled_at &&
      Date.parse(row.scheduled_at) > now &&
      (!a.next || row.scheduled_at < a.next.at)
    ) {
      a.next = {
        at: row.scheduled_at,
        service: (row.service_type as unknown as { name: string } | null)?.name ?? "Serviço",
      };
    }
    activity.set(row.pet_id, a);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
          <p className="text-sm text-gray-neutral">
            O que o petshop sabe de cada um. Com a ficha em dia, o cuidado sai certo.
          </p>
        </div>
        {/* Sem pets, o convite fica no estado vazio — um botão só por tela. */}
        {list.length > 0 && (
          <div className="shrink-0">
            <PetDialog />
          </div>
        )}
      </header>

      {list.length === 0 ? (
        <EmptyState
          icon={<PawPrint className="h-6 w-6" />}
          title="Nenhum pet cadastrado ainda"
          description="Cadastre seu pet para agendar banho e tosa e acompanhar cada atendimento por aqui."
          action={<PetDialog />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((p) => (
            <MyPetCard
              key={p.id}
              pet={p}
              summary={summaries.get(p.id) ?? null}
              activity={activity.get(p.id) ?? EMPTY_ACTIVITY}
              subscription={clubinhoByPet.get(p.id) ?? null}
              schedules={
                schedulesBySubscription.get(clubinhoByPet.get(p.id)?.id ?? "") ?? []
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
