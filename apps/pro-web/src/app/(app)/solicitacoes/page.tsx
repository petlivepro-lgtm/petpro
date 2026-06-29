import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@mylivepet/ui";
import {
  SolicitacaoCard,
  type SolicitacaoGroup,
} from "@/components/solicitacao-card";

export default async function SolicitacoesPage() {
  const supabase = await createClient();

  const [{ data: appointments }, { data: reservations }] = await Promise.all([
    supabase
      .from("appointment")
      .select("id, scheduled_at, notes, tutor_id, pet(name), service_type(name), tutor(full_name)")
      .eq("status", "REQUESTED")
      .order("created_at", { ascending: true }),
    supabase
      .from("product_reservation")
      .select(
        "id, note, expires_at, created_at, tutor_id, tutor(full_name), product_reservation_item(id, quantity, price_cents, product(name))",
      )
      .eq("status", "RESERVED")
      .order("created_at", { ascending: true }),
  ]);

  // Agrupa agendamentos pendentes e reservas ativas por tutor.
  const groups = new Map<string, SolicitacaoGroup>();
  const ensure = (tutorId: string, tutorName: string): SolicitacaoGroup => {
    let g = groups.get(tutorId);
    if (!g) {
      g = { tutorId, tutorName, appointments: [], reservations: [] };
      groups.set(tutorId, g);
    }
    return g;
  };

  for (const a of appointments ?? []) {
    const tutor = a.tutor as unknown as { full_name: string } | null;
    const pet = a.pet as unknown as { name: string } | null;
    const service = a.service_type as unknown as { name: string } | null;
    ensure(a.tutor_id, tutor?.full_name ?? "Tutor").appointments.push({
      id: a.id,
      scheduled_at: a.scheduled_at,
      notes: a.notes,
      petName: pet?.name ?? "Pet",
      serviceName: service?.name ?? "Serviço",
    });
  }

  for (const r of reservations ?? []) {
    const tutor = r.tutor as unknown as { full_name: string } | null;
    const items = (r.product_reservation_item as unknown as {
      id: string;
      quantity: number;
      price_cents: number;
      product: { name: string } | null;
    }[]) ?? [];
    ensure(r.tutor_id, tutor?.full_name ?? "Tutor").reservations.push({
      id: r.id,
      note: r.note,
      expires_at: r.expires_at,
      items: items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        price_cents: i.price_cents,
        productName: i.product?.name ?? "Produto",
      })),
    });
  }

  const list = [...groups.values()];

  return (
    <div>
      <PageHeader
        title="Solicitações"
        subtitle="Agendamentos e produtos reservados pelos tutores no MyLivePet, aguardando confirmação."
      />

      <div className="space-y-3">
        {list.map((group) => (
          <SolicitacaoCard key={group.tutorId} group={group} />
        ))}
        {list.length === 0 && (
          <EmptyState
            icon={<CalendarClock className="h-6 w-6" />}
            title="Nenhuma solicitação pendente"
            description="Quando um tutor agendar ou reservar produtos pelo MyLivePet, o pedido aparece aqui para você confirmar."
          />
        )}
      </div>
    </div>
  );
}
