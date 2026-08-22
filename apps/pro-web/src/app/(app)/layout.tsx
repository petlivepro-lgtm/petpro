import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, Building2, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { Nav } from "@/components/nav";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { SearchTrigger } from "@/components/search-trigger";
import { Avatar, Button, EmptyState } from "@mylivepet/ui";
import { STAFF_ROLE_LABEL } from "@mylivepet/types";
import { signOut } from "./actions";
import { listNotifications } from "./notification-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const tenant = await getActiveTenant(supabase, user.id);
  const fullName = (user.user_metadata?.full_name as string | undefined)?.trim();
  const userName = fullName || user.email || "Usuário";
  const isCollaborator = tenant?.role === "COLLABORATOR";

  // Todo mundo com vínculo tem sino: a gestão recebe os pedidos dos tutores e
  // o colaborador recebe o que entra e sai da agenda dele. Quem separa as duas
  // caixas é a RPC list_notifications (0042), não esta condição.
  const showBell = !!tenant;
  const notifications = showBell ? await listNotifications() : [];
  const bellHint = isCollaborator
    ? "Os atendimentos que entram, saem ou mudam de horário na sua agenda aparecem aqui."
    : "Pedidos de serviço e reservas dos tutores aparecem aqui assim que chegam.";

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
              {showBell && (
                <div className="ml-auto -mr-1">
                  <NotificationBell
                    initial={notifications}
                    channelName="notificacoes-desktop"
                    emptyHint={bellHint}
                  />
                </div>
              )}
            </div>
          </div>
          {tenant && (
            <div className="mb-3">
              <SearchTrigger variant="sidebar" />
            </div>
          )}
          <Nav role={tenant?.role} />
        </div>
        <div className="border-t border-graphite/10 pt-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <Avatar name={userName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-graphite">{userName}</p>
              {tenant && (
                <p className="text-xs text-gray-neutral">{STAFF_ROLE_LABEL[tenant.role]}</p>
              )}
            </div>
          </div>
          {!isCollaborator && (
            <Link
              href="/configuracoes"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-graphite/70 transition-colors hover:bg-surface-muted"
            >
              <Settings className="h-4 w-4" />
              Configurações
            </Link>
          )}
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
          role={tenant?.role}
          bell={
            showBell ? (
              <NotificationBell
                initial={notifications}
                channelName="notificacoes-mobile"
                emptyHint={bellHint}
              />
            ) : null
          }
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

      {/* Uma paleta para o painel inteiro: o Ctrl+K precisa responder em
          qualquer página, e montá-la por página multiplicaria os ouvintes. */}
      <CommandPalette
        tenantId={tenant?.tenantId ?? null}
        role={tenant?.role}
      />
    </div>
  );
}
