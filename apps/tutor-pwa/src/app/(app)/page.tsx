import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Card, Badge } from "@mylivepet/ui";
import { type AppointmentStatus } from "@mylivepet/types";
import { TUTOR_APPOINTMENT_STATUS_LABEL } from "@/lib/status-labels";
import { REJECTION_NOTICE_SELECT, rejectedSince } from "@/lib/produtos";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import { PetsRow } from "@/components/pets-row";
import { RejectionNotices, type RejectionNotice } from "@/components/rejection-notice";

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

  const { data: pets } = await supabase
    .from("pet")
    .select("id, name, species, breed, photo_path")
    .eq("tutor_id", ctx.tutorId)
    .order("name");

  // Reservas recusadas pelo petshop nos últimos dias e ainda não dispensadas:
  // viram aviso no topo da home.
  const { data: rejections } = await supabase
    .from("product_reservation")
    .select(REJECTION_NOTICE_SELECT)
    .eq("tutor_id", ctx.tutorId)
    .eq("status", "REJECTED")
    .gte("rejected_at", rejectedSince())
    .is("rejection_seen_at", null)
    .order("rejected_at", { ascending: false });

  // Média do boletim para o card de cada pet; o histórico completo vive na ficha.
  const [summaries, { data: appts }] = await Promise.all([
    fetchBehaviorSummaries(
      supabase,
      (pets ?? []).map((p) => p.id),
    ),
    supabase
      .from("appointment")
      .select("id, status, scheduled_at, pet:pet_id(name), service_type(name)")
      .eq("tutor_id", ctx.tutorId)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const petRows = (pets ?? []).map((p) => ({
    ...p,
    summary: summaries.get(p.id) ?? null,
  }));
  const appointments = appts ?? [];

  return (
    <div className="space-y-6">
      <RejectionNotices reservations={(rejections ?? []) as unknown as RejectionNotice[]} />

      <section>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Meus pets</h1>
        <p className="text-sm text-gray-neutral">
          Toque num pet para ver a ficha e o boletim de comportamento.
        </p>
        <PetsRow pets={petRows} />
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold text-graphite">Atendimentos</h2>
        {appointments.length === 0 ? (
          <p className="mt-3 text-sm text-gray-neutral">
            Você ainda não tem atendimentos. Que tal agendar um?
          </p>
        ) : (
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-1">
            {appointments.map((a) => {
              const service = a.service_type as unknown as { name: string } | null;
              const pet = a.pet as unknown as { name: string } | null;
              return (
                <Card key={a.id} className="min-w-[15rem] shrink-0 snap-start p-4">
                  <Badge tone={tone[a.status as AppointmentStatus]}>
                    {TUTOR_APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}
                  </Badge>
                  <p className="mt-2 font-medium text-graphite">{service?.name ?? "Serviço"}</p>
                  <p className="text-xs text-gray-neutral">
                    {pet?.name ? `${pet.name} · ` : ""}
                    {formatDate(a.scheduled_at)}
                  </p>
                </Card>
              );
            })}
            <Link
              href="/atendimentos"
              className="flex min-w-[10rem] shrink-0 snap-start items-center justify-center gap-1 rounded-2xl border border-dashed border-graphite/15 px-4 text-sm font-medium text-petrol transition-colors hover:bg-surface-muted"
            >
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
