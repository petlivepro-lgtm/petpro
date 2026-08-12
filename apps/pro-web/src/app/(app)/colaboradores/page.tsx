import { UsersRound, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { Card, PageHeader, StatusChip, EmptyState } from "@mylivepet/ui";
import { hhmm, scheduleSummary } from "@/lib/collaborator-schedule";
import { CollaboratorAccessDialog } from "@/components/collaborator-access-dialog";
import { CollaboratorDialog } from "@/components/collaborator-dialog";
import { DeleteCollaboratorDialog } from "@/components/delete-collaborator-dialog";

export default async function ColaboradoresPage() {
  const supabase = await createClient();
  const [{ data }, tenant] = await Promise.all([
    supabase
      .from("collaborator")
      .select(
        "id, full_name, role_title, active, access_email, profile_id, collaborator_schedule(id, weekday, start_time, end_time)",
      )
      .order("full_name"),
    getActiveTenant(supabase),
  ]);

  const list = data ?? [];
  // Mesmo recorte da policy membership_admin: o acesso ao painel acaba
  // criando uma membership.
  const canManageAccess = tenant?.role === "OWNER" || tenant?.role === "MANAGER";

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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusChip tone={c.active ? "success" : "danger"}>
                      {c.active ? "Ativo" : "Inativo"}
                    </StatusChip>
                    {c.profile_id ? (
                      <StatusChip tone="info">Acesso ao painel</StatusChip>
                    ) : (
                      c.access_email && <StatusChip tone="warning">Acesso pendente</StatusChip>
                    )}
                  </div>
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
                    {canManageAccess && (
                      <CollaboratorAccessDialog
                        collaborator={{
                          id: c.id,
                          full_name: c.full_name,
                          access_email: c.access_email,
                          has_login: c.profile_id !== null,
                        }}
                      />
                    )}
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
