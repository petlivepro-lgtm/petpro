import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { BookingForm } from "./booking-form";

export default async function AgendarPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const [{ data: pets }, { data: services }] = await Promise.all([
    supabase.from("pet").select("id, name").eq("tutor_id", ctx.tutorId),
    supabase
      .from("service_type")
      .select("id, name, price_cents, duration_min")
      .eq("tenant_id", ctx.tenantId)
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Agendar serviço</h1>
        <p className="text-sm text-gray-neutral">
          Envie sua solicitação — o petshop confirma o horário.
        </p>
      </header>

      <BookingForm pets={pets ?? []} services={services ?? []} />
    </div>
  );
}
