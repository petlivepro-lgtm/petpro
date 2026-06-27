import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  PawPrint,
  Stethoscope,
  MessageSquare,
  Scale,
  Syringe,
  Camera,
  FileText,
  Pill,
  FlaskConical,
  CalendarClock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  Avatar,
  Button,
  StatusChip,
  ActionGrid,
  ActionTile,
  Timeline,
  TimelineItem,
  EmptyState,
} from "@mylivepet/ui";
import {
  APPOINTMENT_STATUS_LABEL,
  RESERVATION_STATUS_LABEL,
  type AppointmentStatus,
  type ReservationStatus,
} from "@mylivepet/types";
import { PetTabs } from "@/components/pet-tabs";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { createStaffAppointment } from "./actions";

const statusColor: Record<AppointmentStatus, string> = {
  REQUESTED: "#F2B84B",
  CONFIRMED: "#1D4E5F",
  CHECKED_IN: "#1D6E84",
  IN_PROGRESS: "#FF6A00",
  COMPLETED: "#2E7D5B",
  REJECTED: "#C0392B",
  CANCELLED: "#5B6770",
};

function fmt(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function ageFrom(birth: string | null): string | null {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y} ano${y > 1 ? "s" : ""}` : null, m > 0 ? `${m} mes${m > 1 ? "es" : ""}` : null]
    .filter(Boolean)
    .join(", ") || "recém-nascido";
}

export default async function FichaPetPage({ params }: { params: Promise<{ petId: string }> }) {
  const { petId } = await params;
  const supabase = await createClient();

  const { data: pet } = await supabase
    .from("pet")
    .select(
      "id, name, species, breed, size, birth_date, photo_path, notes, tutor:tutor_id (id, full_name, phone, email)",
    )
    .eq("id", petId)
    .maybeSingle();

  if (!pet) notFound();
  const tutor = pet.tutor as unknown as { id: string; full_name: string; phone: string | null } | null;

  const { data: appts } = await supabase
    .from("appointment")
    .select("id, status, scheduled_at, created_at, service_type(name), feedback(direction, comment, rating)")
    .eq("pet_id", petId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  const appointments = appts ?? [];
  const emAtendimento = appointments.some((a) => a.status === "IN_PROGRESS");

  const { data: reservas } = tutor
    ? await supabase
        .from("product_reservation")
        .select("id, status, created_at, note")
        .eq("tutor_id", tutor.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const meta = [pet.breed, pet.species, pet.size].filter(Boolean).join(" · ");
  const age = ageFrom(pet.birth_date);

  const tiles = [
    { label: "Atendimento", icon: <Stethoscope className="h-6 w-6" />, color: "#2D6CDF", action: true },
    { label: "Observação", icon: <MessageSquare className="h-6 w-6" />, color: "#5B6770" },
    { label: "Peso", icon: <Scale className="h-6 w-6" />, color: "#C0892D" },
    { label: "Vacina", icon: <Syringe className="h-6 w-6" />, color: "#F08A24" },
    { label: "Fotos", icon: <Camera className="h-6 w-6" />, color: "#1D6E84" },
    { label: "Documento", icon: <FileText className="h-6 w-6" />, color: "#2E9E5B" },
    { label: "Receita", icon: <Pill className="h-6 w-6" />, color: "#7A3FB0" },
    { label: "Exame", icon: <FlaskConical className="h-6 w-6" />, color: "#E0556B" },
  ];

  const historico = (
    <Timeline>
      {appointments.length === 0 && (
        <EmptyState icon={<PawPrint className="h-6 w-6" />} title="Sem registros ainda" description="Use a grade Adicionar acima para iniciar o histórico deste pet." />
      )}
      {appointments.map((a, i) => {
        const service = a.service_type as unknown as { name: string } | null;
        const fb = (a.feedback as unknown as { direction: string; comment: string | null }[]) ?? [];
        const behavior = fb.find((f) => f.direction === "STAFF_TO_TUTOR");
        return (
          <TimelineItem
            key={a.id}
            color={statusColor[a.status as AppointmentStatus]}
            icon={<Stethoscope className="h-4 w-4" />}
            title={`${service?.name ?? "Atendimento"} — ${APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}`}
            time={fmt(a.scheduled_at ?? a.created_at)}
            description={behavior?.comment ?? undefined}
            last={i === appointments.length - 1}
          />
        );
      })}
    </Timeline>
  );

  const agenda = (
    <div className="space-y-3">
      {appointments
        .filter((a) => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "REQUESTED"].includes(a.status))
        .map((a) => {
          const service = a.service_type as unknown as { name: string } | null;
          return (
            <Card key={a.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-graphite">{service?.name ?? "Atendimento"}</p>
                <p className="text-xs text-gray-neutral">{fmt(a.scheduled_at)}</p>
              </div>
              <AppointmentStatusBadge status={a.status as AppointmentStatus} />
            </Card>
          );
        })}
      {appointments.filter((a) => ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "REQUESTED"].includes(a.status)).length ===
        0 && <EmptyState icon={<CalendarClock className="h-6 w-6" />} title="Nada agendado" />}
    </div>
  );

  const vendas = (
    <div className="space-y-3">
      {(reservas ?? []).map((r) => (
        <Card key={r.id} className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium text-graphite">Reserva de produtos</p>
            <p className="text-xs text-gray-neutral">{fmt(r.created_at)}</p>
          </div>
          <StatusChip tone={r.status === "COMPLETED" ? "success" : "warning"}>
            {RESERVATION_STATUS_LABEL[r.status as ReservationStatus]}
          </StatusChip>
        </Card>
      ))}
      {(reservas ?? []).length === 0 && (
        <EmptyState icon={<PawPrint className="h-6 w-6" />} title="Nenhuma reserva" />
      )}
    </div>
  );

  return (
    <div>
      <Link
        href="/tutores"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-neutral hover:text-graphite"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {/* Cabeçalho da ficha */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={pet.name} src={pet.photo_path} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-graphite">{pet.name}</h1>
              {emAtendimento && <StatusChip tone="brand">Em atendimento</StatusChip>}
            </div>
            {meta && <p className="text-sm text-gray-neutral">{meta}</p>}
            {age && <p className="text-sm text-gray-neutral">{age}</p>}
            {tutor && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-graphite/5 pt-3">
                <div className="flex items-center gap-2">
                  <Avatar name={tutor.full_name} size="sm" />
                  <span className="text-sm font-medium text-graphite">{tutor.full_name}</span>
                </div>
                {tutor.phone && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-gray-neutral">
                    <Phone className="h-3.5 w-3.5" /> {tutor.phone}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Grade Adicionar */}
      <h2 className="mb-3 font-heading text-lg font-semibold text-graphite">Adicionar</h2>
      <ActionGrid className="mb-8">
        {tiles.map((t) =>
          t.action ? (
            <form key={t.label} action={createStaffAppointment}>
              <input type="hidden" name="pet_id" value={pet.id} />
              <ActionTile type="submit" label={t.label} icon={t.icon} color={t.color} className="w-full" />
            </form>
          ) : (
            <ActionTile key={t.label} label={t.label} icon={t.icon} color={t.color} soon />
          ),
        )}
      </ActionGrid>

      {/* Abas */}
      <PetTabs historico={historico} agenda={agenda} vendas={vendas} />
    </div>
  );
}
