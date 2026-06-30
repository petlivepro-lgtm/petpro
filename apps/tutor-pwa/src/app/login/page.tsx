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

/** email: digita o e-mail | login: já tem senha | code: confirma OTP | password: cria senha */
type Step = "email" | "login" | "code" | "password";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso nao pertence ao app MyLivePet."
      : null;

  function resetTo(next: Step) {
    setError(null);
    setInfo(null);
    setStep(next);
  }

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
      resetTo("login");
      return;
    }
    // first_access → envia código por e-mail e pede confirmação
    await sendCode(true);
  }

  // Envia/reenvia o código OTP. shouldCreateUser=true só no primeiro acesso.
  async function sendCode(createUser: boolean) {
    setLoading(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: createUser },
    });
    setLoading(false);
    if (otpError) {
      setError("Não foi possível enviar o código. Tente novamente em instantes.");
      return;
    }
    setInfo("Enviamos um código para o seu e-mail.");
    setStep("code");
  }

  // Passo 2b: login de quem já tem senha.
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

  // Passo 2a (1/2): confirma o código → cria sessão → vincula o tutor.
  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    if (verifyError) {
      setLoading(false);
      setError("Código inválido ou expirado.");
      return;
    }
    // Vincula a ficha de tutor ao usuário recém-autenticado (RPC SECURITY DEFINER).
    const { error: claimError } = await supabase.rpc("claim_tutor_access");
    setLoading(false);
    if (claimError) {
      setError("Não foi possível ativar o acesso. Procure o petshop.");
      return;
    }
    resetTo("password");
  }

  // Passo 2a (2/2): tutor define a própria senha.
  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_reset_password: false },
    });
    setLoading(false);
    if (updateError) {
      setError("Não foi possível salvar a senha. Tente novamente.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  const headings: Record<Step, { title: string; subtitle: string }> = {
    email: { title: "Bem-vindo", subtitle: "Informe seu e-mail para acessar o app." },
    login: { title: "Bem-vindo de volta", subtitle: "Digite sua senha para entrar." },
    code: { title: "Confirme seu e-mail", subtitle: "Digite o código que enviamos para você." },
    password: { title: "Crie sua senha", subtitle: "Defina uma senha para os próximos acessos." },
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
              onClick={() => resetTo("email")}
            >
              Trocar e-mail
            </button>
            <button
              type="button"
              className="text-orange underline"
              onClick={() => sendCode(false)}
              disabled={loading}
            >
              Entrar com código por e-mail
            </button>
          </div>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onSubmitCode} className="space-y-4">
          <div>
            <Label htmlFor="code">Código de verificação</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              required
            />
          </div>
          {info && <p className="text-sm text-gray-neutral">{info}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Confirmando..." : "Confirmar código"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-gray-neutral underline"
              onClick={() => resetTo("email")}
            >
              Trocar e-mail
            </button>
            <button
              type="button"
              className="text-orange underline"
              onClick={() => sendCode(false)}
              disabled={loading}
            >
              Reenviar código
            </button>
          </div>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={onSubmitPassword} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar senha</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Salvar senha e entrar"}
          </Button>
        </form>
      )}
    </main>
  );
}
