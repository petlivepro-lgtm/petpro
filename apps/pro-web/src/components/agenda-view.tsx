"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  History,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  Button,
  Dialog,
  Input,
  Label,
  PageHeader,
  Select,
  cn,
} from "@mylivepet/ui";
import {
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
  type BehaviorCategory,
  type PaymentTerminalDTO,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { AgendaGrid } from "@/components/agenda-grid";
import { AgendaMonth } from "@/components/agenda-month";
import { AgendaNav } from "@/components/agenda-nav";
import { AgendaHistorico } from "@/components/agenda-historico";
import { NewAppointmentDialog } from "@/components/new-appointment-dialog";
import type { CameraOption } from "@/components/start-appointment-dialog";
import { serviceColor } from "@/lib/agenda-colors";
import type { BookingCollaborator, BookingTutor } from "@/lib/booking-options";
import type { ServiceOption } from "@mylivepet/ui";
import {
  addDays,
  addMonths,
  agendaRange,
  fetchAgenda,
  hourBands,
  slotValue,
  weekDays,
  type AgendaView as ViewMode,
  type CollaboratorWindow,
} from "@/lib/agenda";
import {
  dayKey,
  fetchAtendimentos,
  type AtendimentoRow as Row,
} from "@/lib/atendimentos";

export type CollaboratorOption = { id: string; full_name: string };

/** Serviço do catálogo, só o que a legenda de cores precisa. */
export type LegendService = {
  id: string;
  name: string;
  color_hex: string | null;
};

/**
 * A tela de agenda: calendário por dia, semana ou mês, e o histórico em lista
 * como quarto modo. O modo e a data vivem na URL — dá para mandar o link de um
 * dia específico e o voltar do navegador funciona.
 *
 * Busca, status e profissional são estado local e valem nos três modos: quem
 * abriu o filtro por profissional não quer perdê-lo ao pular de dia.
 */
export function AgendaView({
  initial,
  view,
  date,
  dateExplicit,
  dateFrom,
  dateTo,
  collaborators,
  schedules,
  services,
  cameras,
  behaviorCategories,
  terminals,
  isCollaborator = false,
  canBook,
  tenantId,
  bookingTutors,
  bookingServices,
  bookingCollaborators,
}: {
  initial: Row[];
  view: ViewMode;
  /** Dia visível no calendário, "YYYY-MM-DD". */
  date: string;
  /** `false` = veio do relógio do servidor e precisa ser corrigido no cliente. */
  dateExplicit: boolean;
  dateFrom?: string;
  dateTo?: string;
  collaborators: CollaboratorOption[];
  /** Expediente dos profissionais — define as faixas de horário da grade. */
  schedules: CollaboratorWindow[];
  services: LegendService[];
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  terminals: PaymentTerminalDTO[];
  isCollaborator?: boolean;
  canBook: boolean;
  tenantId: string | null;
  bookingTutors: BookingTutor[];
  bookingServices: ServiceOption[];
  bookingCollaborators: BookingCollaborator[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [collaborator, setCollaborator] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [slot, setSlot] = useState<string | null>(null);

  const isCalendar = view !== "historico";
  const range = agendaRange(view, date);

  // Em produção o servidor roda em UTC, então o "hoje" dele adianta o dia à
  // noite. Quando a URL não trouxe data, quem manda é o relógio de quem olha.
  useEffect(() => {
    if (dateExplicit || !isCalendar) return;
    const today = dayKey(new Date());
    if (today === date) return;
    router.replace(`/atendimentos?view=${view}&date=${today}`, {
      scroll: false,
    });
  }, [dateExplicit, isCalendar, date, view, router]);

  const fetcher = useCallback(() => {
    const supabase = createClient();
    if (view === "historico") {
      return fetchAtendimentos(supabase, {
        historyFrom: dateFrom,
        historyTo: dateTo,
      });
    }
    const { from, to } = agendaRange(view, date);
    return fetchAgenda(supabase, from, to);
  }, [view, date, dateFrom, dateTo]);

  const syncKey = `${view}:${date}:${dateFrom ?? ""}:${dateTo ?? ""}`;
  const rows = useRealtimeList(
    initial,
    fetcher,
    [{ table: "appointment" }],
    "agenda",
    syncKey,
  );

  const hasFilter =
    search.trim() !== "" || status !== "" || collaborator !== "";

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status && r.status !== status) return false;
      if (collaborator === "none" && r.collaboratorId != null) return false;
      if (
        collaborator &&
        collaborator !== "none" &&
        r.collaboratorId !== collaborator
      )
        return false;
      if (term) {
        const haystack =
          `${r.petName} ${r.tutorName ?? ""} ${r.serviceName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, status, collaborator]);

  // As faixas saem da base completa, não da filtrada: a grade não pode encolher
  // ou mudar de forma a cada letra digitada na busca.
  const hours = useMemo(
    () =>
      // O mês não tem faixas de horário — a célula lá é o dia inteiro.
      view === "mes"
        ? []
        : hourBands(
            schedules,
            view === "semana" ? weekDays(date) : [date],
            isCalendar ? rows : [],
          ),
    [schedules, view, date, rows, isCalendar],
  );

  // Só os serviços que aparecem na janela visível — legenda do catálogo inteiro
  // vira uma parede de bolinhas que ninguém lê.
  const legend = useMemo(() => {
    if (!isCalendar) return [];
    const ids = new Set(rows.map((r) => r.serviceId).filter(Boolean));
    return services.filter((s) => ids.has(s.id));
  }, [services, rows, isCalendar]);

  const go = (next: Partial<{ view: ViewMode; date: string }>) => {
    const nextView = next.view ?? view;
    const params = new URLSearchParams({ view: nextView });
    if (nextView === "historico") {
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
    } else {
      params.set("date", next.date ?? date);
    }
    router.replace(`/atendimentos?${params.toString()}`, { scroll: false });
  };

  const step = (dir: -1 | 1) =>
    go({
      date:
        view === "mes"
          ? addMonths(date, dir)
          : addDays(date, view === "semana" ? 7 * dir : dir),
    });

  // As setas do teclado andam pela agenda como as da tela. Só quando não há
  // nada em foco que as consuma: dentro da busca ou de um diálogo aberto, elas
  // são do campo, e virar o mês por baixo seria só confusão.
  useEffect(() => {
    if (!isCalendar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.metaKey || e.ctrlKey || e.altKey || filtersOpen || slot !== null)
        return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable ||
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.closest("[role='dialog']"))
      )
        return;
      e.preventDefault();
      step(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const updateHistoryDate = (key: "from" | "to", value: string) => {
    if (key === "from" && value && dateTo && value > dateTo) return;
    if (key === "to" && value && dateFrom && value < dateFrom) return;
    const params = new URLSearchParams({ view: "historico" });
    const nextFrom = key === "from" ? value : dateFrom;
    const nextTo = key === "to" ? value : dateTo;
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    router.replace(`/atendimentos?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCollaborator("");
  };

  const historyButton = (
    <Button
      variant={view === "historico" ? "primary" : "secondary"}
      size="sm"
      onClick={() => go({ view: view === "historico" ? "dia" : "historico" })}
    >
      {view === "historico" ? (
        <>
          <CalendarDays className="h-4 w-4" /> Calendário
        </>
      ) : (
        <>
          <History className="h-4 w-4" /> Histórico
        </>
      )}
    </Button>
  );

  const filtersButton = (
    <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(true)}>
      <SlidersHorizontal className="h-4 w-4" /> Filtros
      {hasFilter && (
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange" />
      )}
    </Button>
  );

  return (
    <div>
      <PageHeader
        title={isCollaborator ? "Minha agenda" : "Agenda"}
        subtitle={
          isCollaborator
            ? "Os atendimentos atribuídos a você."
            : "Visualize e gerencie os atendimentos do dia."
        }
        actions={
          <>
            {historyButton}
            {filtersButton}
            {canBook && tenantId && (
              <NewAppointmentDialog
                tenantId={tenantId}
                tutors={bookingTutors}
                services={bookingServices}
                collaborators={bookingCollaborators}
              />
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {isCalendar ? (
          <AgendaNav
            view={view}
            date={date}
            onStep={step}
            onGoTo={(next) => go({ date: next })}
          />
        ) : (
          <p className="font-heading text-sm font-semibold text-graphite">
            Histórico de atendimentos
          </p>
        )}

      </div>

      {isCalendar && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {legend.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-2 text-sm text-gray-neutral"
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: serviceColor(s.id, s.color_hex) }}
              />
              {s.name}
            </span>
          ))}
          <div className="ml-auto inline-flex rounded-xl border border-graphite/10 bg-surface p-1">
            {(["dia", "semana", "mes"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => go({ view: mode })}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
                  view === mode
                    ? "bg-orange/10 text-orange"
                    : "text-gray-neutral hover:text-graphite",
                )}
              >
                {mode === "dia" ? "Dia" : mode === "semana" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasFilter && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-neutral">
          <span>
            Filtro ativo — {filtered.length}{" "}
            {filtered.length === 1 ? "atendimento" : "atendimentos"}.
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 font-medium hover:text-graphite"
          >
            <X className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      )}

      <div className="mt-4">
        {view === "historico" ? (
          <AgendaHistorico
            rows={filtered}
            cameras={cameras}
            behaviorCategories={behaviorCategories}
            terminals={terminals}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateChange={updateHistoryDate}
            canConfirm={!isCollaborator}
            hasFilter={hasFilter}
          />
        ) : view === "mes" ? (
          // Clicar num dia leva para o modo Dia: a célula do mês é o dia
          // inteiro, e sem hora não há o que preencher no agendamento.
          <AgendaMonth
            date={date}
            rows={filtered}
            onOpenDay={(day) => go({ view: "dia", date: day })}
          />
        ) : (
          <AgendaGrid
            view={view}
            date={date}
            rows={filtered}
            hours={hours}
            canBook={canBook}
            onPick={(day, hour) => setSlot(slotValue(day, hour))}
          />
        )}
      </div>

      {/* A mesma paginação do topo, repetida sob a grade: no mês ela é alta o
          bastante para a barra de cima já ter saído da tela. */}
      {isCalendar && (
        <div className="mt-4 space-y-2">
          <AgendaNav
            variant="compact"
            view={view}
            date={date}
            onStep={step}
            onGoTo={(next) => go({ date: next })}
          />
          <p className="text-center text-xs text-gray-neutral">
            {view === "mes"
              ? "Clique em um dia para abrir a agenda dele."
              : canBook
                ? "Clique em um horário vazio para adicionar um novo agendamento."
                : `Mostrando ${range.from === range.to ? "o dia" : "a semana"} selecionado.`}
          </p>
        </div>
      )}

      {/* O agendamento a partir da célula clicada — sem gatilho próprio, quem
          abre é a grade. */}
      {canBook && tenantId && (
        <NewAppointmentDialog
          tenantId={tenantId}
          tutors={bookingTutors}
          services={bookingServices}
          collaborators={bookingCollaborators}
          trigger="none"
          open={slot !== null}
          onOpenChange={(open) => !open && setSlot(null)}
          defaultSlot={slot ?? undefined}
        />
      )}

      <Dialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtros"
        description="Valem para o calendário e para o histórico."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="agenda-search">Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral" />
              <Input
                id="agenda-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pet, tutor ou serviço"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="agenda-status">Status</Label>
            <Select
              id="agenda-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              {(
                Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[]
              ).map((s) => (
                <option key={s} value={s}>
                  {APPOINTMENT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>

          {!isCollaborator && (
            <div>
              <Label htmlFor="agenda-collaborator">Profissional</Label>
              <Select
                id="agenda-collaborator"
                value={collaborator}
                onChange={(e) => setCollaborator(e.target.value)}
              >
                <option value="">Todos os profissionais</option>
                <option value="none">Sem profissional</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Limpar
            </Button>
            <Button size="sm" onClick={() => setFiltersOpen(false)}>
              Aplicar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
