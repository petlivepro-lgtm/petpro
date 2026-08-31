import { createClient } from "@/lib/supabase/server";
import { AgendaView } from "@/components/agenda-view";
import { fetchAtendimentos, dayKey } from "@/lib/atendimentos";
import {
  agendaRange,
  fetchAgenda,
  isAgendaView,
  isDayKey,
  type AgendaView as ViewMode,
} from "@/lib/agenda";
import { fetchBehaviorCategories } from "@/lib/behavior";
import { getActiveTenant } from "@/lib/tenant";
import { loadPaymentTerminals } from "@/lib/payment-terminals";
import { loadBookingOptions } from "@/lib/booking-options";
import { canMutateAsRole } from "@mylivepet/types";

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { view: rawView, date: rawDate, from, to } = await searchParams;
  const view: ViewMode = isAgendaView(rawView) ? rawView : "dia";
  const isCalendar = view !== "historico";

  // Sem `date` na URL o servidor chuta o próprio dia (UTC em produção) e o
  // AgendaView corrige para o dia de quem está olhando — o mesmo cuidado com
  // fuso que o painel do colaborador já toma.
  const dateExplicit = isDayKey(rawDate);
  const date = dateExplicit ? rawDate : dayKey(new Date());

  const dateFrom = !isCalendar && isDayKey(from) ? from : undefined;
  const dateTo = !isCalendar && isDayKey(to) ? to : undefined;

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  // O colaborador vê só a agenda dele — o filtro por profissional não se
  // aplica, e a RLS já devolveria apenas o próprio cadastro.
  const isCollaborator = tenant?.role === "COLLABORATOR";
  // Agendar em nome do tutor é do balcão: VIEWER só lê e o colaborador não agenda.
  const canBook = !!tenant && !isCollaborator && canMutateAsRole(tenant.role);

  const range = agendaRange(view, date);

  const [
    rows,
    { data: collaborators },
    { data: schedules },
    { data: services },
    { data: cameras },
    behaviorCategories,
    terminals,
    bookingOptions,
  ] = await Promise.all([
    isCalendar
      ? fetchAgenda(supabase, range.from, range.to)
      : fetchAtendimentos(supabase, {
          historyFrom: dateFrom,
          historyTo: dateTo,
        }),
    // Vale para o colaborador também: a RLS devolve só o próprio cadastro, que
    // é a coluna dele na visão de Dia. O filtro por profissional continua
    // escondido para ele.
    supabase
      .from("collaborator")
      .select("id, full_name, role_title")
      .eq("active", true)
      .order("full_name"),
    // Expediente dos profissionais: é ele que define as faixas de horário da
    // grade (e o buraco do almoço, quando ninguém trabalha) e quem ganha coluna
    // na visão de Dia.
    supabase
      .from("collaborator_schedule")
      .select("collaborator_id, weekday, start_time, end_time"),
    supabase
      .from("service_type")
      .select("id, name, color_hex")
      .order("name"),
    supabase
      .from("camera")
      .select("id, room_label")
      .eq("active", true)
      .order("room_label"),
    tenant
      ? fetchBehaviorCategories(supabase, tenant.tenantId)
      : Promise.resolve([]),
    tenant
      ? loadPaymentTerminals(supabase, tenant.tenantId, { activeOnly: true })
      : Promise.resolve([]),
    canBook
      ? loadBookingOptions(supabase)
      : Promise.resolve({ tutors: [], services: [], addons: [], collaborators: [] }),
  ]);

  // O cabeçalho vive dentro do AgendaView: Filtros e Histórico ficam na linha
  // do título, como no desenho, e os dois dependem do estado do calendário.
  return (
    <div>
      <AgendaView
        initial={rows}
        view={view}
        date={date}
        dateExplicit={dateExplicit}
        dateFrom={dateFrom}
        dateTo={dateTo}
        collaborators={collaborators ?? []}
        schedules={schedules ?? []}
        services={services ?? []}
        cameras={cameras ?? []}
        behaviorCategories={behaviorCategories}
        terminals={terminals}
        isCollaborator={isCollaborator}
        canBook={canBook}
        tenantId={tenant?.tenantId ?? null}
        bookingTutors={bookingOptions.tutors}
        bookingServices={bookingOptions.services}
        bookingAddons={bookingOptions.addons}
        bookingCollaborators={bookingOptions.collaborators}
      />
    </div>
  );
}
