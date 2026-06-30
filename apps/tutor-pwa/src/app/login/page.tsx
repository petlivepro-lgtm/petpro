"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@mylivepet/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/** email: digita o e-mail | login: já tem senha | sent: link enviado por e-mail */
type Step = "email" | "login" | "sent";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso nao pertence ao app MyLivePet."
      : null;

  /** Garante que o usuário logado é um tutor (e não staff). Desloga se não for. */
  async function ensureTutorOrSignOut(userId: string | undefined): Promise<boolean> {
    const [{ data: tutor }, { data: membership }] = await Promise.all([
      supabase.from("tutor").select("id").eq("profile_id", userId ?? "").limit(1).maybeSingle(),
      supabase
        .from("membership")
        .select("profile_id")
        .eq("profile_id", userId ?? "")
        .limit(1)
        .maybeSingle(),
    ]);
    if (!userId || !tutor || membership) {
      await supabase.auth.signOut();
      return false;
    }
    return true;
  }

  // Envia o link mágico que leva à página de criação de senha.
  async function sendLink(createUser: boolean) {
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: createUser,
        emailRedirectTo: `${window.location.origin}/criar-senha`,
      },
    });
    setLoading(false);
    if (otpError) {
      setError("Não foi possível enviar o e-mail. Tente novamente em instantes.");
      return;
    }
    setStep("sent");
  }

  // Passo 1: identifica o estado do e-mail e direciona o fluxo.
  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const value = email.trim().toLowerCase();
    const { data: status, error: rpcError } = await supabase.rpc("tutor_access_status", {
      p_email: value,
    });
    if (rpcError) {
      setLoading(false);
      setError("Não foi possível verificar o e-mail. Tente novamente.");
      return;
    }
    if (status === "not_found") {
      setLoading(false);
      setError("E-mail não encontrado. Procure o petshop para se cadastrar.");
      return;
    }
    if (status === "existing") {
      setLoading(false);
      setError(null);
      setStep("login");
      return;
    }
    // first_access → envia o link para criar a senha
    await sendLink(true);
  }

  // Passo 2 (existing): login de quem já tem senha.
  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInError) {
      setLoading(false);
      setError("E-mail ou senha inválidos.");
      return;
    }
    const ok = await ensureTutorOrSignOut(data.user?.id);
    if (!ok) {
      setLoading(false);
      setError("Você não tem permissão para acessar.");
      return;
    }
    router.replace("/");
  }

  const headings: Record<Step, { title: string; subtitle: string }> = {
    email: { title: "Bem-vindo", subtitle: "Informe seu e-mail para acessar o app." },
    login: { title: "Bem-vindo de volta", subtitle: "Digite sua senha para entrar." },
    sent: { title: "Verifique seu e-mail", subtitle: "Enviamos um link de acesso para você." },
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img src="/brand/logopet.svg" alt="MyLivePet" className="mx-auto h-24 w-auto" />
        <h1 className="mt-1 font-heading text-2xl font-bold text-graphite">
          {headings[step].title}
        </h1>
        <p className="mt-1 text-sm text-gray-neutral">{headings[step].subtitle}</p>
      </div>

      {step === "email" && (
        <form onSubmit={onSubmitEmail} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {(error ?? accessError) && <p className="text-sm text-danger">{error ?? accessError}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Continuar"}
          </Button>
        </form>
      )}

      {step === "login" && (
        <form onSubmit={onSubmitLogin} className="space-y-4">
          <div>
            <Label htmlFor="email-ro">E-mail</Label>
            <Input id="email-ro" type="email" value={email} disabled />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-gray-neutral underline"
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              Trocar e-mail
            </button>
            <button
              type="button"
              className="text-orange underline"
              onClick={() => sendLink(false)}
              disabled={loading}
            >
              Esqueci a senha (receber link)
            </button>
          </div>
        </form>
      )}

      {step === "sent" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-neutral">
            Enviamos um link para <span className="font-medium text-graphite">{email}</span>. Abra o
            e-mail e clique no link para criar sua senha e entrar.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            className="text-sm text-orange underline"
            onClick={() => sendLink(true)}
            disabled={loading}
          >
            {loading ? "Reenviando..." : "Reenviar link"}
          </button>
          <div>
            <button
              type="button"
              className="text-sm text-gray-neutral underline"
              onClick={() => {
                setError(null);
                setStep("email");
              }}
            >
              Trocar e-mail
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
