import { redirect } from "next/navigation";
import { EntregadorDashboard } from "@/components/entregador-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// A rota do dia muda o tempo todo (status de parada, posição); cache estático
// aqui mostraria o trabalho de ontem.
export const dynamic = "force-dynamic";

/**
 * /rota é o mesmo painel que o entregador vê na raiz — existe como endereço
 * próprio para o item de menu e para o href das notificações de rota (0063).
 */
export default async function RotaPage() {
  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) redirect("/login");
  if (tenant.role !== "DELIVERY") redirect("/");

  return <EntregadorDashboard tenant={tenant} />;
}
