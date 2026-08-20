import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { LiveSection } from "@/components/live-section";
import { RecordingsList } from "@/components/recordings-list";
import { RECORDING_FETCH_LIMIT, RECORDING_SELECT, groupRecordings } from "@/lib/recordings";
import { getLiveStream } from "./actions";

export const dynamic = "force-dynamic";

export default async function AoVivoPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const initial = await getLiveStream();

  // Gravações ainda dentro da retenção (RLS: só as dos atendimentos do tutor),
  // agrupadas por atendimento — ver lib/recordings.
  const { data } = await supabase
    .from("recording")
    .select(RECORDING_SELECT)
    .gt("retain_until", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(RECORDING_FETCH_LIMIT);

  const recordings = groupRecordings(data);

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
