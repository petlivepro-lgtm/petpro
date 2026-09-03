import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mylivepet/types/database";
import type { SizePrices } from "@mylivepet/types";
import type { CollaboratorSchedule, ServiceOption } from "@mylivepet/ui";

// Selects em string literal única (o supabase-js só infere o tipo assim) — nada
// de concatenar as colunas de porte numa constante compartilhada.
const TUTOR_SELECT = "id, full_name, cpf, phone, pet(id, name, size)";
const SERVICE_SELECT =
  "id, name, price_cents, price_mini_cents, price_pequeno_cents, price_medio_cents, price_grande_cents, price_gigante_cents, duration_min";
const ADDON_SELECT =
  "id, name, price_cents, price_mini_cents, price_pequeno_cents, price_medio_cents, price_grande_cents, price_gigante_cents";
const COLLABORATOR_SELECT =
  "id, full_name, role_title, collaborator_schedule(weekday, start_time, end_time)";

export type BookingTutor = {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  /** O porte manda no preço do serviço (0058), por isso vem junto do pet. */
  pet: { id: string; name: string; size: string | null }[];
};

/** Serviço do catálogo com os preços por porte ainda por resolver. */
export type BookingService = ServiceOption & SizePrices;

export type BookingCollaborator = {
  id: string;
  full_name: string;
  role_title: string | null;
  collaborator_schedule: CollaboratorSchedule[];
};

export type BookingOptions = {
  tutors: BookingTutor[];
  services: BookingService[];
  /** Extras do catálogo (0056); sem duração, por isso não ocupam horário. */
  addons: BookingService[];
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
    services: (services ?? []) as BookingService[],
    addons: (addons ?? []) as BookingService[],
    collaborators: (collaborators ?? []) as BookingCollaborator[],
  };
}
