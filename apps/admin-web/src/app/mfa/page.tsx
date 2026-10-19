import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { requireAdminPage } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/actions";
import { MfaChallenge, MfaEnroll } from "./mfa-form";

export const metadata: Metadata = { title: "Verificação em 2 etapas" };

function Steps({ current }: { current: 2 }) {
  const steps = ["Senha", "App autenticador", "Painel"];
  return (
    <ol aria-label="Etapas do acesso" className="mb-8 flex flex-wrap gap-2 text-[13px] font-semibold">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={
              active
                ? "flex items-center gap-2 rounded-full bg-petrol py-1.5 pl-1.5 pr-3 text-white"
                : done
                  ? "flex items-center gap-2 rounded-full bg-success/10 py-1.5 pl-1.5 pr-3 text-[#22603F]"
                  : "flex items-center gap-2 rounded-full bg-surface-muted py-1.5 pl-1.5 pr-3 text-gray-neutral"
            }
          >
            <span
              aria-hidden
              className={
                active
                  ? "grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-petrol"
                  : done
                    ? "grid h-[22px] w-[22px] place-items-center rounded-full bg-success text-white"
                    : "grid h-[22px] w-[22px] place-items-center rounded-full bg-white text-gray-neutral"
              }
            >
              {done ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export default async function MfaPage() {
  const admin = await requireAdminPage({ allowPending: true, requireMfa: false });
  if (admin.status === "invited" && !admin.passwordSet) redirect("/ativar");
  if (admin.aal2 && admin.status === "active") redirect("/");

  const supabase = await createSessionClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp[0];

  return (
    <AuthShell>
      <Steps current={2} />
      <div className="mb-6 flex flex-col gap-2">
        <h2 className="font-heading text-[26px] font-extrabold tracking-tight">
          {factor ? "Código de verificação" : "Ligue o app autenticador"}
        </h2>
        <p className="text-[15px] leading-relaxed text-gray-neutral">
          {factor
            ? "Digite os 6 dígitos que o app está mostrando agora. Sem isso nenhuma tela do admin abre."
            : "A verificação em 2 etapas é obrigatória para todo administrador."}
        </p>
      </div>
      {factor ? <MfaChallenge factorId={factor.id} /> : <MfaEnroll />}
      <p className="mt-6 text-[13px] leading-relaxed text-gray-neutral">
        A sessão vale até 12 horas e cai depois de 30 minutos parada. Ações sensíveis pedem o código de novo.
      </p>
      <form action={logoutAction} className="mt-2">
        <button
          type="submit"
          className="min-h-11 text-sm font-semibold text-petrol underline-offset-4 hover:underline"
        >
          Entrar com outra conta
        </button>
      </form>
    </AuthShell>
  );
}
