import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { BottomNav } from "@/components/bottom-nav";
import { SideNav } from "@/components/side-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
  const tenantName = ctx.tenantName;

  return (
    <div className="min-h-screen bg-surface lg:bg-surface-muted">
      <SideNav tenantName={tenantName} />

      <div className="lg:ml-64">
        {/* topo só-mobile */}
        <header className="flex items-center justify-between px-5 pt-6 lg:hidden">
          <div className="min-w-0">
            <img
              src="/brand/logopet.svg"
              alt="MyLivePet"
              className="h-12 max-w-[160px] object-contain"
            />
            {ctx && <p className="truncate text-xs text-gray-neutral">{ctx.tenantName}</p>}
          </div>
        </header>

        <main className="px-5 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
          <div className="mx-auto w-full max-w-md lg:max-w-4xl">
            {ctx ? (
              children
            ) : (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
                Sua conta ainda não está vinculada a um petshop. Peça ao petshop para liberar seu
                acesso ao MyLivePet.
              </div>
            )}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
