import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { peekAdmin } from "@/lib/auth";
import { ClaimFromLink, NewPasswordForm } from "./ativar-flow";

export const metadata: Metadata = { title: "Ativar acesso" };

export default async function AtivarPage() {
  const admin = await peekAdmin();
  if (admin?.status === "active") redirect(admin.aal2 ? "/" : "/mfa");
  if (admin?.status === "invited" && admin.passwordSet) redirect("/mfa");
  const pending = admin?.status === "invited";

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col gap-2">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-petrol/10 text-petrol">
          <KeyRound className="h-[22px] w-[22px]" aria-hidden />
        </span>
        <h2 className="font-heading text-[28px] font-extrabold tracking-tight">Ativar acesso</h2>
        <p className="text-[15px] leading-relaxed text-gray-neutral">
          {pending
            ? "Crie a senha da sua conta administrativa. Depois você liga o app autenticador."
            : "Estamos conferindo o link do seu convite."}
        </p>
      </div>
      {pending && admin ? <NewPasswordForm email={admin.email} /> : <ClaimFromLink />}
    </AuthShell>
  );
}
