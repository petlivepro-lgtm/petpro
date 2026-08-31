import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import type { CollaboratorSchedule, ServiceOption } from "@mylivepet/ui";

// Selects em string literal única (o supabase-js só infere o tipo assim).
const TUTOR_SELECT = "id, full_name, cpf, phone, pet(id, name)";
const SERVICE_SELECT = "id, name, price_cents, duration_min";
const ADDON_SELECT = "id, name, price_cents";
const COLLABORATOR_SELECT =
  "id, full_name, role_title, collaborator_schedule(weekday, start_time, end_time)";

export type BookingTutor = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  pet: { id: string; name: string }[];
};

export type BookingCollaborator = {
  id: string;
  full_name: string;
  role_title: string | null;
  collaborator_schedule: CollaboratorSchedule[];
};

export type BookingOptions = {
  tutors: BookingTutor[];
  services: ServiceOption[];
  /** Extras do catálogo (0056); sem duração, por isso não ocupam horário. */
  addons: ServiceOption[];
  collaborators: BookingCollaborator[];
};

/**
 * Tudo que o diálogo de novo agendamento precisa oferecer: clientes com seus
 * pets, serviços e adicionais ativos, e profissionais com a agenda semanal.
 * A RLS já limita ao tenant ativo.
 */
export async function loadBookingOptions(
  supabase: SupabaseClient<Database>,
  { includeTutors = true }: { includeTutors?: boolean } = {},
): Promise<BookingOptions> {
  const [
    { data: tutors },
    { data: services },
    { data: addons },
    { data: collaborators },
  ] = await Promise.all([
    // A ficha do pet já sabe de quem é o pet: não carrega a lista de clientes.
    includeTutors
      ? supabase.from("tutor").select(TUTOR_SELECT).order("full_name")
      : Promise.resolve({ data: [] }),
    supabase
      .from("service_type")
      .select(SERVICE_SELECT)
      .eq("active", true)
      .order("name"),
    supabase
      .from("service_addon")
      .select(ADDON_SELECT)
      .eq("active", true)
      .order("name"),
    supabase
      .from("collaborator")
      .select(COLLABORATOR_SELECT)
      .eq("active", true)
      .order("full_name"),
  ]);

  return {
    tutors: (tutors ?? []) as BookingTutor[],
    services: (services ?? []) as ServiceOption[],
    addons: (addons ?? []) as ServiceOption[],
    collaborators: (collaborators ?? []) as BookingCollaborator[],
  };
}
