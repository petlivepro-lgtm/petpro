import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";
import { TenantBrand } from "@/components/tenant-brand";
import { ClubinhoBadge } from "@/components/clubinho-badge";
import { NotificationBell } from "@/components/notification-bell";
import { ProfileMenu } from "@/components/profile-menu";
import { listNotifications } from "./notification-actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ctx = await getTutorContext(supabase, user.id);
  const { data: membership } = await supabase
    .from("membership")
    .select("profile_id")
    .eq("profile_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!ctx || membership) {
    await supabase.auth.signOut();
    redirect("/login?erro=acesso");
  }

  // O que o petshop respondeu sobre os pedidos deste tutor (0044). A RPC já
  // recorta por destinatário, então nunca vem nada de outra pessoa.
  const notifications = await listNotifications();

  return (
    <div className="min-h-screen bg-surface lg:bg-surface-muted">
      <SideNav
        tenantName={ctx.tenantName}
        tenantLogoUrl={ctx.tenantLogoUrl}
        clubinho={ctx.clubinho}
        bell={
          <NotificationBell initial={notifications} channelName="notificacoes-desktop" />
        }
      />

      <div className="lg:ml-64">
        {/* topo só-mobile */}
        <header className="flex items-center justify-between px-5 pt-6 lg:hidden">
          <div className="min-w-0">
            <img
              src="/brand/logopet.svg"
              alt="MyLivePet"
              className="h-12 max-w-[160px] object-contain"
            />
            <TenantBrand
              compact
              className="mt-2"
              name={ctx.tenantName}
              logoUrl={ctx.tenantLogoUrl}
            />
            <ClubinhoBadge active={ctx.clubinho} className="mt-1.5" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell initial={notifications} channelName="notificacoes-mobile" />
            {/* Conta: Configurações e Sair. No desktop os dois já estão no pé
                da barra lateral. */}
            <ProfileMenu fullName={ctx.fullName} />
          </div>
        </header>

        <main className="px-5 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mx-auto w-full max-w-md lg:max-w-4xl">
            {ctx ? (
              children
            ) : (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
                Sua conta ainda não está vinculada a um petshop. Peça ao petshop
                para liberar seu acesso ao MyLivePet.
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
