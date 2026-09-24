import { Truck } from "lucide-react";
import { Card, StatusChip } from "@mylivepet/ui";
import {
  DELIVERY_STOP_KIND_LABEL,
  DELIVERY_STOP_STATUS_LABEL,
  formatAddressLine,
  type DeliveryStopKind,
  type DeliveryStopStatus,
} from "@mylivepet/types";
import { createClient } from "@/lib/supabase/server";
import { hojeKey } from "@/lib/rotas";

// Select em string literal única — o supabase-js só infere o tipo assim.
const SELECT =
  "id, kind, status, position, eta_at, cep, street, street_number, complement, district, city, state, fail_reason, delivery_route!inner(route_date, collaborator(full_name)), appointment(pet(name), tutor(full_name))";

type Linha = {
  id: string;
  kind: DeliveryStopKind;
  status: DeliveryStopStatus;
  position: number;
  fail_reason: string | null;
  cep: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  delivery_route: { collaborator: { full_name: string } | null } | null;
  appointment: {
    pet: { name: string } | null;
    tutor: { full_name: string } | null;
  } | null;
};

const TOM: Record<DeliveryStopStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "neutral",
  EN_ROUTE: "warning",
  PICKED_UP: "warning",
  DONE: "success",
  FAILED: "danger",
};

/**
 * O leva-e-traz do dia, para quem está no balcão.
 *
 * Existe porque o atendente é quem atende o telefone: o tutor liga perguntando
 * "já saíram?" e a resposta não pode depender de ligar para o entregador. A
 * gestão vê todas as rotas do dia (policy delivery_stop_staff, 0062).
 *
 * Some da tela quando não há nenhuma parada — um card vazio todo dia, num
 * petshop que não faz leva-e-traz, seria só ruído.
 */
export async function LevaETrazDoDia({ dia }: { dia?: string }) {
  const supabase = await createClient();
  const data = dia ?? hojeKey();

  // Monta a rota do dia quando o petshop tem UM entregador — que é o caso da
  // quase totalidade deles. Sem isto, o atendente marcaria "buscar em casa" no
  // agendamento e não veria parada nenhuma até o entregador abrir o painel
  // dele, o que parece falha do sistema.
  //
  // Com dois ou mais, não dá para adivinhar de quem é a rota: aí cada
  // entregador monta a sua ao abrir o próprio painel, e a primeira a ser
  // montada fica com as paradas (o unique de delivery_stop garante que
  // ninguém duplique a viagem).
  const { data: entregadores } = await supabase
    .from("collaborator")
    .select("id")
    .eq("active", true)
    .eq("access_role", "DELIVERY");

  if (entregadores?.length === 1) {
    await supabase.rpc("build_delivery_route", {
      _collaborator: entregadores[0]!.id,
      _date: data,
    });
  }

  const { data: rows } = await supabase
    .from("delivery_stop")
    .select(SELECT)
    .eq("delivery_route.route_date", data)
    .order("position");

  const paradas = (rows ?? []) as unknown as Linha[];
  if (paradas.length === 0) return null;

  return (
    <Card className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <Truck className="h-5 w-5 text-petrol" />
        <h2 className="font-heading text-base font-semibold text-graphite">
          Leva e traz de hoje
        </h2>
        <span className="text-sm text-gray-neutral">({paradas.length} paradas)</span>
      </div>

      <ul className="divide-y divide-graphite/5">
        {paradas.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-petrol/10 text-xs font-semibold text-petrol">
              {p.position}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-graphite">
                {DELIVERY_STOP_KIND_LABEL[p.kind]} · {p.appointment?.pet?.name ?? "Pet"}
                <span className="font-normal text-gray-neutral">
                  {p.appointment?.tutor?.full_name
                    ? ` · ${p.appointment.tutor.full_name}`
                    : ""}
                </span>
              </p>
              <p className="truncate text-xs text-gray-neutral">
                {formatAddressLine(p) ?? "Cadastro sem endereço"}
                {p.delivery_route?.collaborator?.full_name
                  ? ` · ${p.delivery_route.collaborator.full_name}`
                  : ""}
              </p>
              {p.fail_reason && (
                <p className="text-xs text-danger">Não realizada: {p.fail_reason}</p>
              )}
            </div>
            <StatusChip tone={TOM[p.status]}>
              {DELIVERY_STOP_STATUS_LABEL[p.status]}
            </StatusChip>
          </li>
        ))}
      </ul>
    </Card>
  );
}
