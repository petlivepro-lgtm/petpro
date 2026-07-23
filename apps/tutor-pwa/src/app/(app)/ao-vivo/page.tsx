import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { LiveSection } from "@/components/live-section";
import { RecordingsList, type RecordingRow } from "@/components/recordings-list";
import { getLiveStream } from "./actions";

export const dynamic = "force-dynamic";

export default async function AoVivoPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const initial = await getLiveStream();

  // Gravações ainda dentro da retenção (RLS: só as dos atendimentos do tutor).
  const { data } = await supabase
    .from("recording")
    .select(
      "id, created_at, retain_until, duration_sec, appointment:appointment_id(pet:pet_id(name), service_type(name))",
    )
    .gt("retain_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);

  const recordings: RecordingRow[] = (data ?? []).map((r) => {
    const appt = r.appointment as unknown as {
      pet: { name: string } | null;
      service_type: { name: string } | null;
    } | null;
    return {
      id: r.id,
      created_at: r.created_at,
      retain_until: r.retain_until,
      duration_sec: r.duration_sec,
      petName: appt?.pet?.name ?? "Seu pet",
      serviceName: appt?.service_type?.name ?? "Atendimento",
    };
  });

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Ao vivo</h1>
        <p className="text-sm text-gray-neutral">
          Acompanhe o atendimento do seu pet com segurança e tranquilidade.
        </p>
      </header>

      <LiveSection initial={initial} />

      <RecordingsList initial={recordings} />

      <p className="text-center text-xs text-gray-neutral">
        A transmissão respeita consentimento, finalidade e acesso controlado (LGPD).
        Somente você vê o atendimento do seu pet.
      </p>
    </div>
  );
}
