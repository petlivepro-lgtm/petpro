import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { type AppointmentStatus } from "@mylivepet/types";
import { REJECTION_NOTICE_SELECT, rejectedSince } from "@/lib/produtos";
import { fetchBehaviorSummaries } from "@/lib/behavior";
import { chegadaAtiva, fetchChegadas } from "@/lib/chegada";
import { waNumber } from "@/lib/whatsapp";
import {
  HOME_OPEN_SELECT,
  HOME_REVIEW_SELECT,
  REVIEW_WINDOW_DAYS,
  firstName,
  greeting,
  groupOpenAppointments,
  longToday,
  pendingReviews,
  startOfTodayIso,
  type RawOpenAppointment,
  type RawReviewAppointment,
} from "@/lib/home";
import { PetsRow } from "@/components/pets-row";
import { RejectionNotices, type RejectionNotice } from "@/components/rejection-notice";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { HomeNow } from "@/components/home-now";
import { NextVisit, ReviewReminders, sectionLink, sectionTitle } from "@/components/home-agenda";
import { PetHistory } from "@/components/home-pet-history";
import {
  loadMyClubinho,
  loadMyClubinhoSchedules,
  syncClubinhoPeriods,
} from "@/lib/clubinho";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pet?: string }>;
}) {
  const { pet: petParam } = await searchParams;
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const reviewSince = new Date(
    Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { data: pets },
    { data: rejections },
    { data: openRows },
    { data: reviewRows },
    chegadas,
    { data: tenant },
  ] = await Promise.all([
      supabase
        .from("pet")
        .select("id, name, species, breed, photo_path")
        .eq("tutor_id", ctx.tutorId)
        .order("name"),
      // Reservas recusadas pelo petshop nos últimos dias e ainda não dispensadas:
      // viram aviso no topo da home.
      supabase
        .from("product_reservation")
        .select(REJECTION_NOTICE_SELECT)
        .eq("tutor_id", ctx.tutorId)
        .eq("status", "REJECTED")
        .gte("rejected_at", rejectedSince())
        .is("rejection_seen_at", null)
        .order("rejected_at", { ascending: false }),
      // O que está acontecendo agora e o que vem por aí. Horários de hoje que já
      // passaram continuam valendo: o pet pode só estar atrasado.
      supabase
        .from("appointment")
        .select(HOME_OPEN_SELECT)
        .eq("tutor_id", ctx.tutorId)
        .in("status", ["REQUESTED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"])
        .gte("scheduled_at", startOfTodayIso())
        .order("scheduled_at", { ascending: true })
        .limit(30),
      supabase
        .from("appointment")
        .select(HOME_REVIEW_SELECT)
        .eq("tutor_id", ctx.tutorId)
        .eq("status", "COMPLETED")
        .gte("finished_at", reviewSince)
        .order("finished_at", { ascending: false })
        .limit(20),
      fetchChegadas(supabase),
      // Telefone do petshop, para o atalho de WhatsApp no topo.
      supabase.from("tenant").select("settings").eq("id", ctx.tenantId).maybeSingle(),
    ]);

  const visits = groupOpenAppointments((openRows ?? []) as unknown as RawOpenAppointment[]);
  const happeningNow = visits.filter(
    (v) => v.status === "IN_PROGRESS" || v.status === "CHECKED_IN",
  );
  const upcoming = visits.filter((v) => v.status === "REQUESTED" || v.status === "CONFIRMED");
  const reviews = pendingReviews((reviewRows ?? []) as unknown as RawReviewAppointment[]);
  const chegada = chegadaAtiva(chegadas);

  // Clubinho dos pets. A renovação roda antes da leitura porque esta é a tela
  // onde o tutor confere o saldo — sem isso ele veria o ciclo vencido até
  // alguém do petshop abrir o painel.
  await syncClubinhoPeriods(supabase, ctx.tenantId);
  const clubinho = await loadMyClubinho(supabase, ctx.tutorId);
  const clubinhoSchedules = await loadMyClubinhoSchedules(
    supabase,
    clubinho.map((s) => s.id),
  );

  // Sem horário marcado, o convite para agendar lembra o saldo que ainda sobra.
  const withCredit = clubinho
    .filter((s) => s.status !== "PAUSED" && s.period_id)
    .flatMap((s) =>
      s.credits
        .filter((c) => c.quantity_left > 0)
        .map((c) => ({ pet: s.pet_name, service: c.service_name, left: c.quantity_left })),
    )[0];
  const clubinhoHint = withCredit
    ? `${withCredit.pet} ainda tem ${withCredit.left} de ${withCredit.service} no Clubinho neste ciclo.`
    : null;

  // Card de cada pet: média do boletim (o completo vive na ficha) e o saldo
  // do Clubinho daquele pet.
  const summaries = await fetchBehaviorSummaries(
    supabase,
    (pets ?? []).map((p) => p.id),
  );
  const petRows = (pets ?? []).map((p) => ({
    ...p,
    summary: summaries.get(p.id) ?? null,
    clubinho: clubinho
      .filter((s) => s.pet_id === p.id)
      .map((s) => ({ subscription: s, schedules: clubinhoSchedules.get(s.id) ?? [] })),
  }));

  // Pet do histórico: o da querystring (validado contra os pets do tutor) ou o primeiro.
  const selected = (pets ?? []).find((p) => p.id === petParam) ?? pets?.[0] ?? null;

  const history = selected
    ? (
        (
          await supabase
            .from("appointment")
            .select("id, status, scheduled_at, finished_at, photos, service_type(name)")
            .eq("tutor_id", ctx.tutorId)
            .eq("pet_id", selected.id)
            .order("scheduled_at", { ascending: false, nullsFirst: false })
            .limit(10)
        ).data ?? []
      ).map((a) => ({
        id: a.id,
        status: a.status as AppointmentStatus,
        scheduledAt: a.scheduled_at,
        finishedAt: a.finished_at,
        serviceName:
          (a.service_type as unknown as { name: string } | null)?.name ?? "Serviço",
        photos: a.photos ?? [],
      }))
    : [];

  const name = firstName(ctx.fullName);
  const wa = waNumber(
    ((tenant?.settings ?? {}) as { phone?: string | null }).phone ?? null,
  );
  const waText = encodeURIComponent(`Olá, ${ctx.tenantName}! Aqui é ${ctx.fullName}.`);

  return (
    <div className="space-y-8">
      {/* Atendimento começando, terminando ou o leva-e-traz saindo: a home
          acompanha sem o tutor precisar puxar para atualizar. */}
      <RealtimeRefresh
        channel="inicio"
        watches={[{ table: "appointment" }, { table: "delivery_stop" }]}
      />

      <RejectionNotices reservations={(rejections ?? []) as unknown as RejectionNotice[]} />

      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-graphite text-balance lg:text-3xl">
            {greeting()}
            {name && `, ${name}`}
          </h1>
          <p className="mt-1 text-sm first-letter:uppercase text-gray-neutral">
            {longToday()}
          </p>
        </div>
        {/* Agendar já está no menu e no "Próximo horário"; aqui fica o que
            não tem em outro lugar da home: falar com o petshop. */}
        {wa && (
          <a
            href={`https://wa.me/${wa}?text=${waText}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Falar com ${ctx.tenantName} no WhatsApp`}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-graphite/10 bg-surface px-3.5 text-sm font-medium text-graphite shadow-card transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-graphite focus-visible:ring-offset-2 sm:px-5"
          >
            <MessageCircle className="h-4 w-4 text-success" aria-hidden />
            <span className="hidden sm:inline">Falar com o petshop</span>
          </a>
        )}
      </header>

      <HomeNow visits={happeningNow} chegada={chegada} />

      <div className={reviews.length > 0 ? "grid gap-8 lg:grid-cols-2 lg:gap-6" : undefined}>
        <NextVisit
          visit={upcoming[0] ?? null}
          othersCount={Math.max(upcoming.length - 1, 0)}
          clubinhoHint={clubinhoHint}
        />
        <ReviewReminders reviews={reviews} />
      </div>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={sectionTitle}>Meus pets</h2>
          <Link href="/meus-pets" className={sectionLink}>
            Gerenciar <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="text-sm text-gray-neutral">
          {(pets ?? []).length > 1
            ? "Toque em um pet para ver o histórico dele."
            : clubinho.length > 0
              ? "Boletim de comportamento e saldo do Clubinho."
              : "Boletim de comportamento do seu pet."}
        </p>
        <PetsRow pets={petRows} selectedId={selected?.id ?? null} />
      </section>

      {selected && <PetHistory pet={selected} items={history} />}
    </div>
  );
}
