import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { ChegandoSection } from "@/components/chegando-section";
import { chegadaAtiva, fetchChegadas, fetchPosicao } from "@/lib/chegada";

export const dynamic = "force-dynamic";

export default async function ACaminhoPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const chegadas = await fetchChegadas(supabase);
  const ativa = chegadaAtiva(chegadas);
  const posicao = ativa ? await fetchPosicao(supabase, ativa.routeId) : null;

  return (
    <div className="space-y-5 lg:max-w-3xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">
          A caminho
        </h1>
        <p className="text-sm text-gray-neutral">
          Acompanhe o trajeto de quem vai buscar ou devolver seu pet.
        </p>
      </header>

      <ChegandoSection chegadas={chegadas} posicao={posicao} />

      <p className="text-center text-xs text-gray-neutral">
        A localização do entregador só aparece enquanto ele está a caminho do
        seu endereço, e some quando a entrega termina (LGPD).
      </p>
    </div>
  );
}
