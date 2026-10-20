import Link from "next/link";
import { ChevronRight, LogOut, Mail, Phone, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTutorContext } from "@/lib/tutor-context";
import { Avatar, Card } from "@mylivepet/ui";
import { TutorProfileForm, type TutorProfile } from "@/components/tutor-profile-form";
import { TenantBrand } from "@/components/tenant-brand";
import { SettingsPush } from "@/components/settings-push";
import { SettingsPassword } from "@/components/settings-password";
import { signOut } from "../actions";

const sectionTitle = "font-heading text-lg font-semibold text-graphite";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const ctx = await getTutorContext(supabase);
  if (!ctx) return null;

  const { data: tutor } = await supabase
    .from("tutor")
    .select(
      "full_name, email, phone, cep, street, street_number, complement, district, city, state",
    )
    .eq("id", ctx.tutorId)
    .maybeSingle();

  const profile: TutorProfile = {
    full_name: tutor?.full_name ?? ctx.fullName,
    email: tutor?.email ?? "",
    phone: tutor?.phone ?? "",
    cep: tutor?.cep ?? null,
    street: tutor?.street ?? null,
    street_number: tutor?.street_number ?? null,
    complement: tutor?.complement ?? null,
    district: tutor?.district ?? null,
    city: tutor?.city ?? null,
    state: tutor?.state ?? null,
  };

  return (
    <div className="space-y-8 lg:max-w-3xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Configurações</h1>
        <p className="text-sm text-gray-neutral">Seus dados, a senha e os avisos deste aparelho.</p>
      </header>

      {/* Quem é você para o petshop: o que aparece na ficha do lado de lá. */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={profile.full_name} size="xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xl font-bold text-graphite">{profile.full_name}</p>
          <div className="mt-1 flex flex-col gap-1 text-sm text-gray-neutral sm:flex-row sm:flex-wrap sm:gap-x-4">
            {profile.email && (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{profile.email}</span>
              </span>
            )}
            {profile.phone && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                {profile.phone}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 rounded-xl bg-surface-muted px-3 py-2">
          <p className="text-xs text-gray-neutral">Cliente de</p>
          <TenantBrand compact name={ctx.tenantName} logoUrl={ctx.tenantLogoUrl} />
        </div>
      </Card>

      <section>
        <h2 className={sectionTitle}>Meus dados</h2>
        <p className="text-sm text-gray-neutral">
          O petshop vê estes dados. O endereço é o que libera o leva e traz no agendamento.
        </p>
        <div className="mt-3">
          <TutorProfileForm tutor={profile} />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Acesso e avisos</h2>
        <Card className="mt-3 divide-y divide-graphite/5 p-0">
          <div className="p-5">
            <SettingsPassword />
          </div>
          <div className="p-5">
            <SettingsPush />
          </div>
        </Card>
      </section>

      <section>
        <h2 className={sectionTitle}>Privacidade e conta</h2>
        <Card className="mt-3 divide-y divide-graphite/5 overflow-hidden p-0">
          <Link
            href="/ajuda/novo?assunto=PRIVACY"
            className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-muted/70 focus-visible:bg-surface-muted focus-visible:outline-none"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-petrol/[0.07] text-petrol">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-graphite">Meus dados e privacidade</span>
              <span className="block text-sm text-gray-neutral">
                Pedir uma cópia dos seus dados ou a exclusão da conta.
              </span>
            </span>
            <ChevronRight
              className="h-[18px] w-[18px] shrink-0 text-graphite/30 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-danger/[0.04] focus-visible:bg-danger/[0.06] focus-visible:outline-none"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-danger/10 text-danger">
                <LogOut className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-danger">Sair da conta</span>
                <span className="block text-sm text-gray-neutral">Encerra o acesso neste aparelho.</span>
              </span>
            </button>
          </form>
        </Card>
      </section>
    </div>
  );
}
