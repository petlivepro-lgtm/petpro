import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { peekAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

const NOTICES: Record<string, string> = {
  expirou: "Sua sessão terminou por inatividade ou tempo. Entre de novo.",
  saiu: "Você saiu da administração.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const admin = await peekAdmin();
  if (admin?.status === "active") redirect(admin.aal2 ? "/" : "/mfa");

  const { motivo } = await searchParams;
  const notice = motivo ? NOTICES[motivo] : undefined;

  return (
    <AuthShell>
      <div className="mb-8 flex flex-col gap-2">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-petrol/10 text-petrol">
          <ShieldCheck className="h-[22px] w-[22px]" aria-hidden />
        </span>
        <h2 className="font-heading text-[28px] font-extrabold tracking-tight">Entrar</h2>
        <p className="text-[15px] text-gray-neutral">Use a conta administrativa que recebeu por convite.</p>
      </div>
      <LoginForm notice={notice} />
      <p className="mt-6 text-[13px] leading-relaxed text-gray-neutral">
        Esqueceu a senha? Peça um novo convite a um superadmin — não há recuperação pública aqui.
      </p>
    </AuthShell>
  );
}
