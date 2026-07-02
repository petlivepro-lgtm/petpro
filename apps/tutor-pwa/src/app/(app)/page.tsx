import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Card, Badge } from "@mylivepet/ui";
import { type AppointmentStatus } from "@mylivepet/types";
import { TUTOR_APPOINTMENT_STATUS_LABEL } from "@/lib/status-labels";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const tone: Record<AppointmentStatus, React.ComponentProps<typeof Badge>["tone"]> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function HomePage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: pets }, { data: appts }] = await Promise.all([
    supabase.from("pet").select("id, name, species, breed").eq("tutor_id", ctx.tutorId),
    supabase
      .from("appointment")
      .select("id, status, scheduled_at, pet(name), service_type(name)")
      .eq("tutor_id", ctx.tutorId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
          {(pets ?? []).map((p) => (
            <Card key={p.id} className="min-w-[140px] p-4 sm:min-w-0">
              <div className="text-2xl">🐾</div>
              <p className="mt-1 font-heading font-semibold text-graphite">{p.name}</p>
              <p className="text-xs text-gray-neutral">{p.breed ?? p.species ?? "Pet"}</p>
            </Card>
          ))}
          {(pets ?? []).length === 0 && (
            <p className="text-sm text-gray-neutral">Nenhum pet cadastrado.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold text-graphite">Atendimentos</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {(appts ?? []).map((a) => {
            const pet = a.pet as unknown as { name: string } | null;
            const service = a.service_type as unknown as { name: string } | null;
            return (
              <Card key={a.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-graphite">
                    {pet?.name ?? "Pet"} · {service?.name ?? "Serviço"}
                  </p>
                  <p className="text-xs text-gray-neutral">{formatDate(a.scheduled_at)}</p>
                </div>
                <Badge tone={tone[a.status as AppointmentStatus]}>
                  {TUTOR_APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                </Badge>
              </Card>
            );
          })}
          {(appts ?? []).length === 0 && (
            <p className="text-sm text-gray-neutral">
              Você ainda não tem atendimentos. Que tal agendar um?
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
