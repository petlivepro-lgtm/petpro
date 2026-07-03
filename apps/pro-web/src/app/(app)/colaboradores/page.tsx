import { UsersRound, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader, StatusChip, EmptyState } from "@mylivepet/ui";
import { WEEKDAY_LABEL, type Weekday } from "@mylivepet/types";
import { CollaboratorDialog } from "@/components/collaborator-dialog";
import { DeleteCollaboratorDialog } from "@/components/delete-collaborator-dialog";

type ScheduleRow = { id: string; weekday: number; start_time: string; end_time: string };

/** "08:00:00" (time do Postgres) → "08:00" */
function hhmm(t: string) {
  return t.slice(0, 5);
}

/** Resume as janelas por dia: "Segunda 08:00–12:00, 13:00–18:00". */
function scheduleSummary(schedules: ScheduleRow[]): string[] {
  const byDay = new Map<number, ScheduleRow[]>();
  for (const s of schedules) {
    const list = byDay.get(s.weekday) ?? [];
    list.push(s);
    byDay.set(s.weekday, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([weekday, list]) => {
      const ranges = list
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
        .map((s) => `${hhmm(s.start_time)}–${hhmm(s.end_time)}`)
        .join(", ");
      return `${WEEKDAY_LABEL[weekday as Weekday]} ${ranges}`;
    });
}

export default async function ColaboradoresPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("collaborator")
    .select("id, full_name, role_title, active, collaborator_schedule(id, weekday, start_time, end_time)")
    .order("full_name");

  const list = data ?? [];

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle="Profissionais do petshop e seus horários de trabalho para agendamento."
        actions={<CollaboratorDialog />}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title="Nenhum colaborador cadastrado"
          description="Cadastre o primeiro colaborador e os horários dele para os tutores agendarem."
          action={<CollaboratorDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const summary = scheduleSummary(c.collaborator_schedule);
            return (
              <Card key={c.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-heading font-semibold text-graphite">{c.full_name}</p>
                    {c.role_title && <p className="text-sm text-gray-neutral">{c.role_title}</p>}
                  </div>
                  <StatusChip tone={c.active ? "success" : "danger"}>
                    {c.active ? "Ativo" : "Inativo"}
                  </StatusChip>
                </div>

                <div className="mt-3 space-y-1">
                  {summary.length === 0 ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-gray-neutral">
                      <CalendarClock className="h-3.5 w-3.5" /> Sem horários cadastrados
                    </p>
                  ) : (
                    summary.map((line) => (
                      <p key={line} className="inline-flex items-center gap-1.5 text-sm text-gray-neutral">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {line}
                      </p>
                    ))
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-graphite/5 pt-3">
                  {!c.active && <span className="text-xs text-gray-neutral">Oculto no app</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <CollaboratorDialog
                      collaborator={{
                        id: c.id,
                        full_name: c.full_name,
                        role_title: c.role_title,
                        active: c.active,
                        schedules: c.collaborator_schedule.map((s) => ({
                          weekday: s.weekday,
                          start_time: hhmm(s.start_time),
                          end_time: hhmm(s.end_time),
                        })),
                      }}
                    />
                    <DeleteCollaboratorDialog collaboratorId={c.id} collaboratorName={c.full_name} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
