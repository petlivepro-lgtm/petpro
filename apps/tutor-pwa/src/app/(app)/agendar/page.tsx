import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { BookingForm } from "./booking-form";

const ERROR_MESSAGES: Record<string, string> = {
  horario: "Esse horário acabou de ser reservado por outro tutor. Escolha outro horário.",
  grade:
    "Esse profissional não atende no dia e horário escolhidos. Escolha outro horário.",
  "1": "Não foi possível enviar a solicitação. Confira os dados e tente novamente.",
};

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: pets }, { data: services }, { data: addons }, { data: collaborators }] =
    await Promise.all([
    // O porte vem junto: é ele que define o preço do serviço (0058).
    supabase.from("pet").select("id, name, size").eq("tutor_id", ctx.tutorId),
    supabase
      .from("service_type")
      .select(
        "id, name, price_cents, price_mini_cents, price_pequeno_cents, price_medio_cents, price_grande_cents, price_gigante_cents, duration_min",
      )
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .order("name"),
    // Extras do catálogo (0056): sem duração, não ocupam horário.
    supabase
      .from("service_addon")
      .select(
        "id, name, price_cents, price_mini_cents, price_pequeno_cents, price_medio_cents, price_grande_cents, price_gigante_cents",
      )
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .order("name"),
    supabase
      .from("collaborator")
      .select("id, full_name, role_title, collaborator_schedule(weekday, start_time, end_time)")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .order("full_name"),
  ]);

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Agendar serviço</h1>
        <p className="text-sm text-gray-neutral">
          Envie sua solicitação — o petshop confirma o horário.
        </p>
      </header>

      {erro && (
        <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-graphite">
          {ERROR_MESSAGES[erro] ?? ERROR_MESSAGES["1"]}
        </div>
      )}

      <BookingForm
        pets={pets ?? []}
        services={services ?? []}
        addons={addons ?? []}
        collaborators={collaborators ?? []}
        tenantId={ctx.tenantId}
      />
    </div>
  );
}
