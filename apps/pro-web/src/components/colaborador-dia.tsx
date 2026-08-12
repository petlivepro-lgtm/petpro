"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Play,
} from "lucide-react";
import { Avatar, Card, EmptyState, StatCard, cn } from "@mylivepet/ui";
import type { BehaviorCategory } from "@mylivepet/types";
import { AtendimentoRow } from "@/components/atendimento-row";
import { AppointmentQuickActions } from "@/components/appointment-quick-actions";
import { AppointmentStatusBadge } from "@/components/status-badge";
import type { CameraOption } from "@/components/start-appointment-dialog";
import { createClient } from "@/lib/supabase/client";
import {
  dayKey,
  fetchAtendimentos,
  formatTime,
  type AtendimentoRow as Row,
} from "@/lib/atendimentos";
import { useRealtimeList } from "@/lib/use-realtime-list";

/**
 * O dia do colaborador: números do dia, o atendimento da vez em destaque e a
 * agenda de hoje com as ações de iniciar e finalizar na própria linha.
 *
 * É client para que "hoje" seja o dia do fuso de quem está olhando — no
 * servidor (UTC em produção) a virada do dia sairia adiantada. Também é o que
 * permite uma única assinatura de realtime alimentar as três seções.
 *
 * `sidebar` chega pronta do Server Component (horário de trabalho e
 * indicadores do mês), que não precisa de interatividade.
 */
export function ColaboradorDia({
  initial,
  cameras,
  behaviorCategories,
  sidebar,
}: {
  initial: Row[];
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  sidebar: React.ReactNode;
}) {
  const fetcher = useCallback(() => fetchAtendimentos(createClient()), []);
  const rows = useRealtimeList(
    initial,
    fetcher,
    [{ table: "appointment" }],
    "dashboard-colaborador",
  );

  const { hoje, emAndamento, finalizadosHoje, destaque } = useMemo(() => {
    const todayKey = dayKey(new Date());
    const doDia = rows
      .filter((r) => r.scheduledAt != null && dayKey(new Date(r.scheduledAt)) === todayKey)
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));

    // O que está acontecendo agora manda no destaque; senão, o próximo da fila
    // que ainda não terminou.
    const rodando = rows.find((r) => r.status === "IN_PROGRESS") ?? null;
    const proximo =
      doDia.find(
        (r) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(r.status),
      ) ?? null;

    return {
      hoje: doDia,
      emAndamento: rows.filter((r) => r.status === "IN_PROGRESS").length,
      finalizadosHoje: doDia.filter((r) => r.status === "COMPLETED").length,
      destaque: rodando ?? proximo,
    };
  }, [rows]);

  const live = destaque?.status === "IN_PROGRESS";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Hoje"
          value={hoje.length}
          hint="atendimentos seus"
          icon={<CalendarDays className="h-5 w-5" />}
          accent="#1D4E5F"
        />
        <StatCard
          label="Em atendimento"
          value={emAndamento}
          hint="acontecendo agora"
          icon={<Play className="h-5 w-5" />}
          accent="#FF6A00"
        />
        <StatCard
          label="Finalizados hoje"
          value={finalizadosHoje}
          hint="concluídos"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="#2E9E5B"
        />
      </div>

      <Card
        className={cn(
          "mt-6",
          live && "bg-orange/5 ring-1 ring-orange/30",
        )}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-neutral">
          {live ? "Acontecendo agora" : "Próximo atendimento"}
        </p>

        {destaque ? (
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={destaque.petName} src={destaque.petPhoto} size="lg" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/atendimentos/${destaque.id}`}
                  className="font-heading text-xl font-bold text-graphite hover:text-orange"
                >
                  {destaque.petName}
                </Link>
                <AppointmentStatusBadge status={destaque.status} />
              </div>
              <p className="text-sm text-gray-neutral">
                {destaque.serviceName}
                {destaque.tutorName && ` · ${destaque.tutorName}`}
              </p>
            </div>

            <div className="text-center">
              <p
                className={cn(
                  "font-heading text-3xl font-bold tabular-nums",
                  live ? "text-orange" : "text-graphite",
                )}
              >
                {formatTime(destaque.scheduledAt)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <AppointmentQuickActions
                appointmentId={destaque.id}
                status={destaque.status}
                cameras={cameras}
                behaviorCategories={behaviorCategories}
                canConfirm={false}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-neutral">
            Nada pendente por agora. Bom trabalho!
          </p>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold text-graphite">
              Agenda de hoje
            </h2>
            <Link
              href="/atendimentos"
              className="inline-flex items-center gap-1 text-sm font-medium text-orange hover:underline"
            >
              Ver tudo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {hoje.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck className="h-6 w-6" />}
              title="Nenhum atendimento hoje"
              description="Quando o petshop atribuir um atendimento a você, ele aparece aqui."
            />
          ) : (
            <div className="space-y-2">
              {hoje.map((row) => (
                <AtendimentoRow
                  key={row.id}
                  row={row}
                  cameras={cameras}
                  behaviorCategories={behaviorCategories}
                  canConfirm={false}
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">{sidebar}</div>
      </div>
    </>
  );
}
