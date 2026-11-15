/**
 * Num pedido com vários serviços (request_group_id), adicionais e leva-e-traz
 * são do PEDIDO, não de cada serviço: ficam gravados numa linha só — a
 * primeira, quando o pedido nasce (createStaffBooking, 0056/0062). Depois de
 * criado não há coluna dizendo qual foi a primeira, então a líder é a que
 * carrega esses dados; sem nenhum, o próprio serviço em edição assume.
 *
 * Módulo neutro: a página (server) e a action usam a mesma regra.
 */
export type GroupMember = {
  id: string;
  pickup: boolean;
  dropoff: boolean;
  appointment_addon: { id: string; service_addon_id: string | null }[] | null;
};

export function groupLeader(
  members: GroupMember[],
  selfId: string,
): GroupMember | undefined {
  return (
    members.find(
      (m) => m.pickup || m.dropoff || (m.appointment_addon?.length ?? 0) > 0,
    ) ?? members.find((m) => m.id === selfId)
  );
}
