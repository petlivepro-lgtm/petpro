import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { AjudaHub } from "@/components/ajuda-hub";

/**
 * Triagem: o tutor escolhe o assunto ANTES de escrever. Assunto do petshop vai
 * para o próprio petshop (sem chamado); assunto do app vira chamado para a
 * plataforma; problema grave vira chamado em sigilo.
 */
export default async function AjudaPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  // RLS: só os chamados que este tutor abriu.
  const [{ data: tickets }, { data: unreadIds }] = await Promise.all([
    supabase
      .from("support_ticket")
      .select("id, number, subject, status, updated_at")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase.rpc("support_unread_tickets", { p_tenant: ctx.tenantId, p_origin: "TUTOR" }),
  ]);
  const unread = new Set<string>((unreadIds ?? []) as string[]);

  return (
    <AjudaHub
      tenantName={ctx.tenantName}
      tenantLogoUrl={ctx.tenantLogoUrl}
      tickets={tickets ?? []}
      unread={unread}
    />
  );
}
