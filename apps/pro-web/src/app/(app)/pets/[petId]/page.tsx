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
  Crown,
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
  BEHAVIOR_BADGE_LABEL,
  BEHAVIOR_BADGE_TONE,
  RESERVATION_STATUS_LABEL,
  behaviorBadgeOf,
  canMutateAsRole,
  formatBehaviorScore,
  type AppointmentStatus,
  type ReservationStatus,
} from "@mylivepet/types";
import { RatingStars } from "@mylivepet/ui";
import { PetTabs } from "@/components/pet-tabs";
import { PetPhotoDialog } from "@/components/pet-photo-dialog";
import { EditPetDialog } from "@/components/edit-pet-dialog";
import { DeletePetDialog } from "@/components/delete-pet-dialog";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { BehaviorReportView } from "@/components/behavior-report-view";
import { fetchBehaviorSummaries, fetchPetBehaviorReports } from "@/lib/behavior";
import { getActiveTenant } from "@/lib/tenant";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import { loadBookingOptions } from "@/lib/booking-options";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import {
  loadClubinhoPlans,
  loadClubinhoSchedules,
  loadPetSubscription,
  loadSchedulePreview,
  syncClubinho,
} from "@/lib/clubinho";
import { ClubinhoBalance } from "@/components/clubinho-balance";
import { ClubinhoScheduleList } from "@/components/clubinho-schedule-list";
import { ClubinhoScheduleDialog } from "@/components/clubinho-schedule-dialog";
import { ClubinhoSubscriptionDialog } from "@/components/clubinho-subscription-dialog";
import { ClubinhoStatusActions } from "@/components/clubinho-status-actions";
import { CLUBINHO_STATUS_LABEL, clubinhoCycleLabel, formatBRL } from "@mylivepet/types";

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
  const tenant = await getActiveTenant(supabase);
  const isCollaborator = tenant?.role === "COLLABORATOR";

  // O colaborador lê a view collaborator_pet (0031): mesma ficha, com o nome do
  // tutor e sem os contatos dele — ele não tem acesso à tabela `tutor`.
  const { data: pet } = isCollaborator
    ? await supabase
        .from("collaborator_pet")
        .select(
          "id, name, species, breed, size, birth_date, photo_path, notes, tutor_id, tutor_name",
        )
        .eq("id", petId)
        .maybeSingle()
        .then(({ data, error }) => ({
          data: data
            ? {
                ...data,
                tutor: { id: data.tutor_id, full_name: data.tutor_name, phone: null },
              }
            : null,
          error,
        }))
    : await supabase
        .from("pet")
        .select(
          "id, name, species, breed, size, birth_date, photo_path, notes, tutor:tutor_id (id, full_name, phone, email)",
        )
        .eq("id", petId)
        .maybeSingle();

  if (!pet) notFound();
  const tutor = pet.tutor as unknown as { id: string; full_name: string; phone: string | null } | null;
  // As colunas de uma view são sempre nullable nos tipos gerados; o filtro por
  // id já garante que estas duas existem.
  const petId_ = pet.id as string;
  const petName = pet.name as string;

  const { data: appts } = await supabase
    .from("appointment")
    .select(
      "id, status, scheduled_at, created_at, service_type(name), pet_behavior_report(note)",
    )
    .eq("pet_id", petId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  const appointments = appts ?? [];

  // Agendar em nome do tutor é do balcão: VIEWER só lê e o colaborador não agenda.
  const canBook = !!tenant && !isCollaborator && canMutateAsRole(tenant.role);
  // Corrigir o cadastro também é do balcão — canMutateAsRole já exclui COLLABORATOR.
  const canEdit = !!tenant && canMutateAsRole(tenant.role);

  const [behaviorReports, summaries, bookingOptions] = await Promise.all([
    fetchPetBehaviorReports(supabase, petId),
    fetchBehaviorSummaries(supabase, [petId]),
    // O pet já define o cliente: não precisa da lista de tutores.
    canBook
      ? loadBookingOptions(supabase, { includeTutors: false })
      : Promise.resolve({ tutors: [], services: [], addons: [], collaborators: [] }),
  ]);
  const summary = summaries.get(petId) ?? null;
  const behaviorBadge = behaviorBadgeOf(
    summary?.averageScore ?? null,
    summary?.reportCount ?? 0,
  );
  const emAtendimento = appointments.some((a) => a.status === "IN_PROGRESS");
  // O guard de exclusão (0051) barra as duas situações em que o pet está na
  // loja agora, não só a que acende o selo "Em atendimento".
  const naLoja = appointments.some((a) => a.status === "CHECKED_IN");

  // Reserva de produtos é dado comercial: fora do escopo do colaborador.
  const { data: reservas } =
    tutor && !isCollaborator
      ? await supabase
          .from("product_reservation")
          .select("id, status, created_at, note")
          .eq("tutor_id", tutor.id)
          .order("created_at", { ascending: false })
      : { data: [] };

  // Clubinho: dado comercial, então fora do escopo do colaborador. A renovação
  // roda antes da leitura porque esta é uma das telas onde o saldo é
  // consultado (ver syncClubinhoPeriods).
  const showClubinho = !!tenant && !isCollaborator;
  if (showClubinho) await syncClubinho(supabase, tenant!.tenantId);
  const [subscription, clubinhoPlans, clubinhoTerminals] = showClubinho
    ? await Promise.all([
        loadPetSubscription(supabase, petId),
        canEdit
          ? loadClubinhoPlans(supabase, tenant!.tenantId, { activeOnly: true })
          : Promise.resolve([]),
        canEdit
          ? loadPaymentTerminals(supabase, tenant!.tenantId, {
              activeOnly: true,
            })
          : Promise.resolve([]),
      ])
    : [null, [], []];

  // Horários fixos e as datas que eles produzem no ciclo corrente.
  const [clubinhoSchedules, clubinhoOccurrences] = subscription
    ? await Promise.all([
        loadClubinhoSchedules(supabase, [subscription.id]).then(
          (map) => map.get(subscription.id) ?? [],
        ),
        loadSchedulePreview(supabase, subscription.id),
      ])
    : [[], []];

  const meta = [pet.breed, pet.species, pet.size].filter(Boolean).join(" · ");
  const age = ageFrom(pet.birth_date);

  const tiles = [
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
        const reports =
          (a.pet_behavior_report as unknown as { note: string | null }[]) ?? [];
        const behavior = reports[0];
        return (
          <TimelineItem
            key={a.id}
            color={statusColor[a.status as AppointmentStatus]}
            icon={<Stethoscope className="h-4 w-4" />}
            title={`${service?.name ?? "Atendimento"} — ${APPOINTMENT_STATUS_LABEL[a.status as AppointmentStatus]}`}
            time={fmt(a.scheduled_at ?? a.created_at)}
            description={behavior?.note ?? undefined}
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
        href={isCollaborator ? "/pets" : "/tutores"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-neutral hover:text-graphite"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {/* Cabeçalho da ficha */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative shrink-0">
            <Avatar name={petName} src={pet.photo_path} size="xl" />
            <PetPhotoDialog petId={petId_} petName={petName} photoPath={pet.photo_path} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-graphite">{pet.name}</h1>
              {emAtendimento && <StatusChip tone="brand">Em atendimento</StatusChip>}
              {canEdit && tutor && (
                <div className="ml-auto flex items-center">
                  <EditPetDialog
                    pet={{
                      id: petId_,
                      tutor_id: tutor.id,
                      name: petName,
                      species: pet.species,
                      breed: pet.breed,
                      size: pet.size,
                      birth_date: pet.birth_date,
                      notes: pet.notes,
                    }}
                  />
                  <DeletePetDialog
                    petId={petId_}
                    petName={petName}
                    appointmentCount={appointments.length}
                    behaviorReportCount={behaviorReports.length}
                    hasClubinho={!!subscription}
                    inProgress={emAtendimento || naLoja}
                  />
                </div>
              )}
            </div>
            {meta && <p className="text-sm text-gray-neutral">{meta}</p>}
            {age && <p className="text-sm text-gray-neutral">{age}</p>}
            {pet.notes && (
              <p className="mt-2 whitespace-pre-line text-sm text-graphite">{pet.notes}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              {summary?.averageScore !== null && summary !== null ? (
                <>
                  <RatingStars value={Math.round(summary.averageScore!)} size="sm" />
                  <span className="text-sm text-gray-neutral">
                    {formatBehaviorScore(summary.averageScore)} ·{" "}
                    {summary.reportCount}{" "}
                    {summary.reportCount === 1 ? "avaliação" : "avaliações"}
                  </span>
                </>
              ) : (
                <span className="text-sm text-gray-neutral">
                  Ainda sem boletim
                </span>
              )}
              {behaviorBadge && (
                <StatusChip tone={BEHAVIOR_BADGE_TONE[behaviorBadge]}>
                  {BEHAVIOR_BADGE_LABEL[behaviorBadge]}
                </StatusChip>
              )}
            </div>
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

      {/* Clubinho: o saldo é do pet, então é aqui que ele mora */}
      {showClubinho && (subscription || clubinhoPlans.length > 0) && (
        <Card className="mb-6">
          {subscription ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-graphite/5 pb-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Crown className="h-4 w-4 shrink-0 text-petrol" />
                    <p className="font-heading font-semibold text-graphite">
                      {subscription.plan_name}
                    </p>
                    {subscription.status !== "ACTIVE" && (
                      <StatusChip tone="warning">
                        {CLUBINHO_STATUS_LABEL[subscription.status]}
                      </StatusChip>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-gray-neutral">
                    {formatBRL(subscription.price_cents)} ·{" "}
                    {clubinhoCycleLabel(
                      subscription.plan_cycle,
                      subscription.plan_cycle_days,
                    )}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center">
                    <ClubinhoSubscriptionDialog
                      subscription={subscription}
                      plans={clubinhoPlans}
                      terminals={clubinhoTerminals}
                    />
                    <ClubinhoStatusActions subscription={subscription} />
                  </div>
                )}
              </div>
              <ClubinhoBalance subscription={subscription} className="pt-3" />

              <ClubinhoScheduleList
                schedules={clubinhoSchedules}
                occurrences={clubinhoOccurrences}
                petId={petId_}
                canManage={canEdit && subscription.status === "ACTIVE"}
                className="mt-3 border-t border-graphite/5 pt-3"
              >
                <ClubinhoScheduleDialog
                  subscription={subscription}
                  collaborators={bookingOptions.collaborators}
                />
              </ClubinhoScheduleList>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 shrink-0 text-petrol" />
                <div>
                  <p className="font-heading font-semibold text-graphite">
                    Fora do Clubinho
                  </p>
                  <p className="text-sm text-gray-neutral">
                    O pacote é por pet: assinar aqui não mexe nos outros pets do
                    tutor.
                  </p>
                </div>
              </div>
              {canEdit && (
                <ClubinhoSubscriptionDialog
                  plans={clubinhoPlans}
                  pets={[
                    {
                      id: petId_,
                      name: petName,
                      tutor_name: tutor?.full_name ?? "",
                    },
                  ]}
                  presetPetId={petId_}
                  terminals={clubinhoTerminals}
                  trigger="cta"
                  size="sm"
                />
              )}
            </div>
          )}
        </Card>
      )}

      {/* Grade Adicionar — abrir atendimento é do balcão, não do colaborador */}
      {!isCollaborator && (
        <>
          <h2 className="mb-3 font-heading text-lg font-semibold text-graphite">Adicionar</h2>
          <ActionGrid className="mb-8">
            {canBook && tenant && (
              <NewAppointmentDialog
                tenantId={tenant.tenantId}
                services={bookingOptions.services}
                addons={bookingOptions.addons}
                collaborators={bookingOptions.collaborators}
                fixedPet={{ id: petId_, name: petName }}
                trigger="tile"
              />
            )}
            {tiles.map((t) => (
              <ActionTile key={t.label} label={t.label} icon={t.icon} color={t.color} soon />
            ))}
          </ActionGrid>
        </>
      )}

      {/* Abas */}
      <PetTabs
        historico={historico}
        boletim={<BehaviorReportView reports={behaviorReports} />}
        agenda={agenda}
        vendas={isCollaborator ? undefined : vendas}
      />
    </div>
  );
}
