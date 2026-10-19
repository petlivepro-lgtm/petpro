import { requireAdminPage } from "@/lib/auth";
import { countNewTickets } from "@/lib/data";
import { Sidebar } from "@/components/sidebar";

// Tudo aqui depende da sessão e de dado vivo: nunca pré-renderizar.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // O layout NÃO substitui o guard de cada página (layouts não re-executam em
  // toda navegação, e Server Actions não passam por eles). É só para o menu.
  const admin = await requireAdminPage();
  const supportCount = await countNewTickets();

  return (
    <div className="min-h-screen bg-surface-muted">
      <Sidebar role={admin.role} name={admin.displayName} supportCount={supportCount} />
      <main className="flex min-h-screen min-w-0 flex-col lg:ml-[248px]">{children}</main>
    </div>
  );
}
