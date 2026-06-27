import { Check, X, CalendarClock, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button, Card, Avatar, PageHeader, EmptyState, StatusChip } from "@mylivepet/ui";
import { updateAppointmentStatus } from "../actions";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default async function SolicitacoesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointment")
    .select("id, scheduled_at, notes, pet(name), service_type(name), tutor(full_name)")
    .eq("status", "REQUESTED")
    .order("created_at", { ascending: true });

  return (
    <div>
      <PageHeader
        title="Solicitações de agendamento"
        subtitle="Pedidos feitos pelos tutores no MyLivePet, aguardando confirmação."
      />

      <div className="space-y-3">
        {(data ?? []).map((a) => {
          const pet = a.pet as unknown as { name: string } | null;
          const service = a.service_type as unknown as { name: string } | null;
          const tutor = a.tutor as unknown as { full_name: string } | null;
          return (
            <Card key={a.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={tutor?.full_name ?? "Tutor"} />
                <div>
                  <p className="font-heading font-semibold text-graphite">
                    {pet?.name ?? "Pet"} · {service?.name ?? "Serviço"}
                  </p>
                  <p className="text-sm text-gray-neutral">{tutor?.full_name ?? "Tutor"}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusChip tone="warning">
                      <Clock className="h-3 w-3" /> {formatDate(a.scheduled_at)}
                    </StatusChip>
                    {a.notes && <span className="text-sm italic text-gray-neutral">“{a.notes}”</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <form action={updateAppointmentStatus}>
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <input type="hidden" name="status" value="CONFIRMED" />
                  <Button size="sm" type="submit">
                    <Check className="h-4 w-4" /> Confirmar
                  </Button>
                </form>
                <form action={updateAppointmentStatus}>
                  <input type="hidden" name="appointment_id" value={a.id} />
                  <input type="hidden" name="status" value="REJECTED" />
                  <Button size="sm" variant="secondary" type="submit">
                    <X className="h-4 w-4" /> Recusar
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
        {(data ?? []).length === 0 && (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Nenhuma solicitação pendente"
            description="Quando um tutor agendar pelo MyLivePet, o pedido aparece aqui para você confirmar."
          />
        )}
      </div>
    </div>
  );
}
