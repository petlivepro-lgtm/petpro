import { redirect } from "next/navigation";
import { LogOut, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { Avatar, Button, EmptyState } from "@mylivepet/ui";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenant = await getActiveTenant(supabase);
  const email = user.email ?? "Usuário";

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <aside className="fixed inset-y-0 hidden w-64 flex-col justify-between bg-graphite p-4 text-white md:flex">
        <div>
          <div className="mb-8 px-2 pt-2">
            <img src="/brand/logopet.svg" alt="Pet Live Pro" className="h-10 w-auto" />
            <p className="mt-0.5 text-xs text-gray-soft/60">{tenant?.tenantName ?? "—"}</p>
          </div>
          <Nav />
        </div>
        <div className="border-t border-white/10 pt-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <Avatar name={email} size="sm" className="bg-white/10 text-white" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{email}</p>
              {tenant && <p className="text-xs capitalize text-gray-soft/60">{tenant.role.toLowerCase()}</p>}
            </div>
          </div>
          <form action={signOut}>
            <Button
              variant="ghost"
              className="w-full justify-start text-gray-soft/80 hover:bg-white/5 hover:text-white"
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <MobileNav tenantName={tenant?.tenantName ?? "—"} email={email} role={tenant?.role} />
        <main className="flex-1 p-5 md:p-8">
          <div className="mx-auto max-w-6xl">
            {tenant ? (
              children
            ) : (
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title="Conta sem vínculo com petshop"
                description="Seu usuário ainda não está vinculado a um petshop. É preciso uma membership (tenant + papel) para acessar o painel."
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
