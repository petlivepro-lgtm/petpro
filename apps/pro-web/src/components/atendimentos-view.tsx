"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Play,
  Search,
  X,
} from "lucide-react";
import {
  Card,
  DatePicker,
  EmptyState,
  Input,
  Select,
  StatCard,
  Tabs,
  type TabItem,
} from "@mylivepet/ui";
import {
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
  type BehaviorCategory,
  type PaymentTerminalDTO,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { AtendimentoRow } from "@/components/atendimento-row";
import type { CameraOption } from "@/components/start-appointment-dialog";
import {
  bucketOf,
  dayKey,
  fetchAtendimentos,
  groupByDay,
  type AtendimentoRow as Row,
  type Bucket,
} from "@/lib/atendimentos";

export type CollaboratorOption = { id: string; full_name: string };

const TABS_ORDER: Bucket[] = ["hoje", "proximos", "historico"];

const EMPTY: Record<Bucket, { title: string; description: string }> = {
  hoje: {
    title: "Nenhum atendimento para hoje",
    description:
      "Os atendimentos agendados para o dia aparecem aqui, em ordem de horário.",
  },
  proximos: {
    title: "Nenhum atendimento agendado",
    description:
      "Agendamentos futuros confirmados ou aguardando confirmação aparecem aqui.",
  },
  historico: {
    title: "Nenhum atendimento anterior",
    description:
      "Atendimentos já realizados, recusados ou cancelados ficam neste histórico.",
  },
};

export function AtendimentosView({
  initial,
  collaborators,
  cameras,
  behaviorCategories,
  terminals,
  activeTab,
  dateFrom,
  dateTo,
  isCollaborator = false,
}: {
  initial: Row[];
  collaborators: CollaboratorOption[];
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  terminals: PaymentTerminalDTO[];
  activeTab: Bucket;
  dateFrom?: string;
  dateTo?: string;
  /** O colaborador só vê a agenda dele: sem fila de solicitações nem filtro
   *  por profissional (a RLS já entrega apenas os atendimentos dele). */
  isCollaborator?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [collaborator, setCollaborator] = useState("");

  const fetcher = useCallback(
    () =>
      fetchAtendimentos(
        createClient(),
        activeTab === "historico"
          ? { historyFrom: dateFrom, historyTo: dateTo }
          : undefined,
      ),
    [activeTab, dateFrom, dateTo],
  );
  const syncKey = `${activeTab}:${dateFrom ?? ""}:${dateTo ?? ""}`;
  const rows = useRealtimeList(
    initial,
    fetcher,
    [{ table: "appointment" }],
    "atendimentos",
    syncKey,
  );

  const todayKey = dayKey(new Date());

  // Resumo do dia — sempre sobre a base completa, independente dos filtros.
  const summary = useMemo(() => {
    const today = rows.filter(
      (r) =>
        r.scheduledAt != null && dayKey(new Date(r.scheduledAt)) === todayKey,
    );
    return {
      today: today.length,
      inProgress: rows.filter((r) => r.status === "IN_PROGRESS").length,
      requested: rows.filter((r) => r.status === "REQUESTED").length,
      doneToday: today.filter((r) => r.status === "COMPLETED").length,
    };
  }, [rows, todayKey]);

  const hasDateFilter = activeTab !== "hoje" && Boolean(dateFrom || dateTo);
  const hasFilter =
    search.trim() !== "" ||
    status !== "" ||
    collaborator !== "" ||
    hasDateFilter;

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

  const byBucket = useMemo(() => {
    const acc: Record<Bucket, Row[]> = {
      hoje: [],
      proximos: [],
      historico: [],
    };
    for (const r of filtered) acc[bucketOf(r, todayKey)].push(r);
    return acc;
  }, [filtered, todayKey]);

  const activeRows = useMemo(() => {
    const bucketRows = byBucket[activeTab];
    if (!hasDateFilter) return bucketRows;

    return bucketRows.filter((row) => {
      if (!row.scheduledAt) return false;
      const key = dayKey(new Date(row.scheduledAt));
      if (dateFrom && key < dateFrom) return false;
      if (dateTo && key > dateTo) return false;
      return true;
    });
  }, [activeTab, byBucket, dateFrom, dateTo, hasDateFilter]);

  const tabs: TabItem[] = TABS_ORDER.map((id) => ({
    id,
    label:
      id === "historico"
        ? "Histórico"
        : `${id === "hoje" ? "Hoje" : "Próximos"} (${
            id === "proximos" && activeTab === "proximos"
              ? activeRows.length
              : byBucket[id].length
          })`,
  }));

  const groups = useMemo(
    () =>
      groupByDay(
        activeRows,
        activeTab === "historico" ? "desc" : "asc",
        todayKey,
      ),
    [activeRows, activeTab, todayKey],
  );

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setCollaborator("");
    if (hasDateFilter) {
      router.replace(`/atendimentos?tab=${activeTab}`, { scroll: false });
    }
  };

  const updateDate = (key: "from" | "to", value: string) => {
    if (key === "from" && value && dateTo && value > dateTo) return;
    if (key === "to" && value && dateFrom && value < dateFrom) return;

    const params = new URLSearchParams({ tab: activeTab });
    const nextFrom = key === "from" ? value : dateFrom;
    const nextTo = key === "to" ? value : dateTo;
    if (nextFrom) params.set("from", nextFrom);
    if (nextTo) params.set("to", nextTo);
    router.replace(`/atendimentos?${params.toString()}`, { scroll: false });
  };

  const changeTab = (id: string) => {
    router.replace(`/atendimentos?tab=${id}`, { scroll: false });
  };

  return (
    <div>
      <div
        className={
          isCollaborator
            ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
            : "grid grid-cols-2 gap-4 lg:grid-cols-4"
        }
      >
        <StatCard
          label="Hoje"
          value={summary.today}
          hint="atendimentos do dia"
          icon={<CalendarDays className="h-5 w-5" />}
          accent="#1D4E5F"
        />
        <StatCard
          label="Em atendimento"
          value={summary.inProgress}
          hint="acontecendo agora"
          icon={<Play className="h-5 w-5" />}
          accent="#FF6A00"
        />
        {!isCollaborator && (
          <Link href="/solicitacoes" className="block">
            <StatCard
              label="Aguardando"
              value={summary.requested}
              hint="confirmar solicitação"
              icon={<CalendarClock className="h-5 w-5" />}
              accent="#C0892D"
              className="h-full transition-shadow hover:shadow-card-hover"
            />
          </Link>
        )}
        <StatCard
          label="Finalizados hoje"
          value={summary.doneToday}
          hint="concluídos"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="#2E9E5B"
        />
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={changeTab}
        className="mt-6"
      />

      <Card className="mt-4 flex flex-col gap-3 p-4 md:flex-row md:flex-wrap md:items-end">
        <div className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-neutral" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por pet, tutor ou serviço"
            className="pl-9"
            aria-label="Buscar atendimento"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="md:w-48"
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {(Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {APPOINTMENT_STATUS_LABEL[s]}
              </option>
            ),
          )}
        </Select>
        {!isCollaborator && (
          <Select
            value={collaborator}
            onChange={(e) => setCollaborator(e.target.value)}
            className="md:w-52"
            aria-label="Filtrar por profissional"
          >
            <option value="">Todos os profissionais</option>
            <option value="none">Sem profissional</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
              </option>
            ))}
          </Select>
        )}
        {activeTab !== "hoje" && (
          <>
            <div className="w-full sm:w-40">
              <label
                htmlFor={`${activeTab}-from`}
                className="mb-1.5 block text-xs font-medium text-gray-neutral"
              >
                De
              </label>
              <DatePicker
                id={`${activeTab}-from`}
                mode="date"
                value={dateFrom ?? ""}
                max={dateTo}
                onChange={(value) => updateDate("from", value)}
              />
            </div>
            <div className="w-full sm:w-40">
              <label
                htmlFor={`${activeTab}-to`}
                className="mb-1.5 block text-xs font-medium text-gray-neutral"
              >
                Até
              </label>
              <DatePicker
                id={`${activeTab}-to`}
                mode="date"
                value={dateTo ?? ""}
                min={dateFrom}
                onChange={(value) => updateDate("to", value)}
              />
            </div>
          </>
        )}
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-gray-neutral hover:text-graphite"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        )}
      </Card>

      <div className="mt-4 space-y-6">
        {groups.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title={
              hasFilter
                ? "Nenhum atendimento encontrado"
                : EMPTY[activeTab].title
            }
            description={
              hasFilter
                ? "Ajuste a busca ou os filtros para ver outros atendimentos."
                : EMPTY[activeTab].description
            }
          />
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-surface-muted/95 px-1 py-1.5 backdrop-blur">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-graphite">
                  {group.label}
                </h2>
                <span className="text-xs text-gray-neutral">
                  {group.rows.length}{" "}
                  {group.rows.length === 1 ? "atendimento" : "atendimentos"}
                </span>
              </div>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <AtendimentoRow
                    key={row.id}
                    row={row}
                    cameras={cameras}
                    behaviorCategories={behaviorCategories}
                    terminals={terminals}
                    canConfirm={!isCollaborator}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
