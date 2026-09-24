import { redirect } from "next/navigation";
import { EntregadorRota } from "@/components/entregador-rota";
import { carregarDiaDoEntregador, hojePorExtenso } from "@/lib/entregador-dia";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// A rota do dia muda o tempo todo (status de parada, posição); cache estático
// aqui mostraria o trabalho de ontem.
export const dynamic = "force-dynamic";

/**
 * /rota é a tela de trabalho do entregador: mapa, parada da vez e o que vem
 * depois. O resumo do dia fica no painel da raiz. É também o href das
 * notificações de rota (0063).
 */
export default async function RotaPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) redirect("/login");
  if (tenant.role !== "DELIVERY") redirect("/");

  const { me, rota, dia, petshop } = await carregarDiaDoEntregador(supabase);

  return (
    <EntregadorRota
      rota={rota}
      dia={dia}
      subtitulo={hojePorExtenso()}
      petshop={petshop}
      veiculo={me?.vehicle ?? null}
    />
  );
}
