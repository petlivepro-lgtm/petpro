import type { ReservationStatus } from "@mylivepet/types";
import type { SolicitacaoGroup } from "@/components/solicitacao-card";

// Colunas das consultas de Solicitações — reutilizadas no render inicial (server)
// e no refetch em tempo real (client), garantindo o mesmo shape nos dois lados.
export const SOLICITACAO_APPOINTMENT_SELECT =
  "id, scheduled_at, notes, tutor_id, request_group_id, pet(name), service_type(name), tutor(full_name), collaborator(full_name), appointment_addon(id, name, price_cents)";
export const SOLICITACAO_RESERVATION_SELECT = `id, status, note, expires_at, created_at, tutor_id, tutor(full_name),
  product_reservation_item(id, quantity, price_cents, variant_label, product_name, product(name))`;

type RawAppointment = {
  id: string;
  scheduled_at: string | null;
  notes: string | null;
  tutor_id: string;
  request_group_id: string | null;
  pet: { name: string } | null;
  service_type: { name: string } | null;
  tutor: { full_name: string } | null;
  collaborator: { full_name: string } | null;
  /** Extras pedidos junto (0056); ficam na primeira linha do grupo. */
  appointment_addon: { id: string; name: string; price_cents: number }[] | null;
};

type RawReservation = {
  id: string;
  status: ReservationStatus;
  note: string | null;
  expires_at: string | null;
  tutor_id: string;
  tutor: { full_name: string } | null;
  product_reservation_item: {
    id: string;
    quantity: number;
    price_cents: number;
    variant_label: string | null;
    /** Snapshot (0037): é o que sobra quando o produto é excluído do catálogo. */
    product_name: string | null;
    product: { name: string } | null;
  }[];
};

// ---- "Solicitações recentes" do dashboard (lista enxuta) --------------------

export const RECENT_SOLICITACAO_SELECT =
  "id, scheduled_at, pet(name), service_type(name), tutor(full_name)";

export type RecentRequest = {
  id: string;
  scheduled_at: string | null;
  petName: string;
  serviceName: string;
  tutorName: string;
};

type RawRecentRow = {
  id: string;
  scheduled_at: string | null;
  pet: { name: string } | null;
  service_type: { name: string } | null;
  tutor: { full_name: string } | null;
};

export function mapRecent(rows: RawRecentRow[]): RecentRequest[] {
  return rows.map((a) => ({
    id: a.id,
    scheduled_at: a.scheduled_at,
    petName: a.pet?.name ?? "Pet",
    serviceName: a.service_type?.name ?? "Serviço",
    tutorName: a.tutor?.full_name ?? "Tutor",
  }));
}

/**
 * Agrupa agendamentos pendentes (REQUESTED) e reservas ativas (RESERVED) por
 * tutor, no formato consumido pelo SolicitacaoCard.
 */
export function buildSolicitacaoGroups(
  appointments: RawAppointment[],
  reservations: RawReservation[],
): SolicitacaoGroup[] {
  const groups = new Map<string, SolicitacaoGroup>();
  const ensure = (tutorId: string, tutorName: string): SolicitacaoGroup => {
    let g = groups.get(tutorId);
    if (!g) {
      g = { tutorId, tutorName, appointments: [], reservations: [] };
      groups.set(tutorId, g);
    }
    return g;
  };

  for (const a of appointments) {
    ensure(a.tutor_id, a.tutor?.full_name ?? "Tutor").appointments.push({
      id: a.id,
      scheduled_at: a.scheduled_at,
      notes: a.notes,
      petName: a.pet?.name ?? "Pet",
      serviceName: a.service_type?.name ?? "Serviço",
      addons: (a.appointment_addon ?? []).map((x) => ({
        id: x.id,
        name: x.name,
        priceCents: x.price_cents,
      })),
      collaboratorName: a.collaborator?.full_name ?? null,
      requestGroupId: a.request_group_id,
    });
  }

  for (const r of reservations) {
    const items = r.product_reservation_item ?? [];
    ensure(r.tutor_id, r.tutor?.full_name ?? "Tutor").reservations.push({
      id: r.id,
      status: r.status,
      note: r.note,
      expires_at: r.expires_at,
      items: items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        price_cents: i.price_cents,
        productName: i.product?.name ?? i.product_name ?? "Produto",
        variantLabel: i.variant_label,
      })),
    });
  }

  return [...groups.values()];
}
