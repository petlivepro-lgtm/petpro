import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Building2, Settings } from "lucide-react";
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
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const userName = fullName || user.email || "Usuário";

  return (
    <div className="flex min-h-screen bg-surface-muted">
      <aside className="fixed inset-y-0 hidden w-64 flex-col justify-between border-r border-graphite/10 bg-surface p-4 md:flex">
        <div>
          <div className="mb-8 px-2 pt-2">
            <img
              src="/brand/logopet.svg"
              alt="Pet Live Pro"
              className="h-20 w-auto"
            />
            <div className="mt-4 flex items-center gap-2">
              {tenant?.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tenant.logoUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg object-cover"
                />
              )}
              <p className="truncate text-sm font-medium text-graphite">{tenant?.tenantName ?? "—"}</p>
            </div>
          </div>
          <Nav />
        </div>
        <div className="border-t border-graphite/10 pt-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <Avatar name={userName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-graphite">{userName}</p>
            </div>
          </div>
          <Link
            href="/configuracoes"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-graphite/70 transition-colors hover:bg-surface-muted"
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
          <form action={signOut}>
            <Button
              variant="ghost"
              className="w-full justify-start text-graphite/70 hover:bg-surface-muted"
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col md:ml-64">
        <MobileNav
          tenantName={tenant?.tenantName ?? "—"}
          logoUrl={tenant?.logoUrl ?? null}
          userName={userName}
        />
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
