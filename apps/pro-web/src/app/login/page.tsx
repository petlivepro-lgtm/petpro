"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, PasswordInput } from "@mylivepet/ui";
import {
  activateCollaboratorAccess,
  identifyStaff,
  sendStaffResetLink,
} from "./actions";
import { MIN_PASSWORD_LENGTH } from "./password-rules";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

/**
 * identify: pede o e-mail e descobre se já tem senha ou é primeiro acesso
 * create  : colaborador convidado define a própria senha
 * login   : e-mail + senha
 * forgot  : pede o e-mail para receber o link de redefinição
 * sent    : link enviado
 */
type Step = "identify" | "create" | "login" | "forgot" | "sent";

const TITLES: Record<Step, string> = {
  identify: "Acessar painel",
  create: "Criar sua senha",
  login: "Acessar painel",
  forgot: "Recuperar senha",
  sent: "Recuperar senha",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("identify");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso não pertence ao painel do petshop."
      : null;

  function goTo(next: Step) {
    setStep(next);
    setError(null);
  }

  /** Volta ao começo para digitar outro e-mail. */
  function restart() {
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice(null);
    goTo("identify");
  }

  async function onSubmitIdentify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const result = await identifyStaff(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFullName(result.fullName);
    goTo(result.status === "first_access" ? "create" : "login");
  }

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await activateCollaboratorAccess(email, newPassword);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setNotice("Senha criada com sucesso. Agora entre com ela.");
    goTo("login");
  }

  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError("E-mail ou senha inválidos.");
      return;
    }

    const { data: membership } = await supabase
      .from("membership")
      .select("profile_id")
      .eq("profile_id", data.user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Este acesso não pertence ao painel do petshop.");
      return;
    }

    // O destino de cada papel é decidido no middleware: o colaborador não
    // pode ver o painel de gestão e cai direto na agenda dele.
    router.replace("/");
  }

  /** Dispara o link de redefinição — vale em qualquer aparelho (ver actions.ts). */
  async function sendResetLink(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    const result = await sendStaffResetLink(resetEmail);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSentTo(result.email);
    setStep("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img
            src="/brand/logopet.svg"
            alt="Pet Live Pro"
            className="mx-auto mb-3 h-20 w-auto"
          />
          <h1 className="font-heading text-2xl font-bold text-graphite">
            {TITLES[step]}
          </h1>
          {step === "identify" && (
            <p className="mt-1 text-sm text-gray-neutral">
              Gestão profissional do cuidado pet.
            </p>
          )}
          {step === "create" && (
            <p className="mt-1 text-sm text-gray-neutral">
              {fullName ? `Bem-vindo(a), ${fullName}! ` : ""}
              Este é seu primeiro acesso — escolha uma senha.
            </p>
          )}
          {step === "forgot" && (
            <p className="mt-1 text-sm text-gray-neutral">
              Informe o e-mail da sua conta para receber o link.
            </p>
          )}
        </div>

        {step === "identify" && (
          <>
            <form onSubmit={onSubmitIdentify} className="space-y-4">
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
              {(error ?? accessError) && (
                <p className="text-sm text-danger">{error ?? accessError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Verificando..." : "Continuar"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-gray-neutral">
              Não tem petshop?{" "}
              <Link
                href="/cadastrar"
                className="font-medium text-orange hover:underline"
              >
                Cadastrar
              </Link>
            </p>
          </>
        )}

        {step === "create" && (
          <form onSubmit={onSubmitCreate} className="space-y-4">
            <div>
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <p className="mt-1 text-xs text-gray-neutral">
                Mínimo de {MIN_PASSWORD_LENGTH} caracteres.
              </p>
            </div>
            <div>
              <Label htmlFor="confirm-password">Repetir senha</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar senha"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-gray-neutral underline"
                onClick={restart}
              >
                Usar outro e-mail
              </button>
            </div>
          </form>
        )}

        {step === "login" && (
          <>
            <form onSubmit={onSubmitLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email">E-mail</Label>
                <Input id="login-email" type="email" value={email} readOnly />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {notice && <p className="text-sm text-success">{notice}</p>}
              {(error ?? accessError) && (
                <p className="text-sm text-danger">{error ?? accessError}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                className="text-sm text-orange underline"
                onClick={() => {
                  setResetEmail(email);
                  goTo("forgot");
                }}
              >
                Esqueci minha senha
              </button>
              <button
                type="button"
                className="text-sm text-gray-neutral underline"
                onClick={restart}
              >
                Usar outro e-mail
              </button>
            </div>
          </>
        )}

        {step === "forgot" && (
          <form onSubmit={sendResetLink} className="space-y-4">
            <div>
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enviando..." : "Enviar link"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-gray-neutral underline"
                onClick={() => goTo(email ? "login" : "identify")}
              >
                Voltar para o login
              </button>
            </div>
          </form>
        )}

        {step === "sent" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-neutral">
              Enviamos um link para{" "}
              <span className="font-medium text-graphite">{sentTo}</span>. Abra o
              e-mail e clique no link para criar uma nova senha — ele funciona em
              qualquer aparelho.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="button"
              className="text-sm text-orange underline"
              onClick={() => sendResetLink()}
              disabled={loading}
            >
              {loading ? "Reenviando..." : "Reenviar link"}
            </button>
            <div>
              <button
                type="button"
                className="text-sm text-gray-neutral underline"
                onClick={() => goTo(email ? "login" : "identify")}
              >
                Voltar para o login
              </button>
            </div>
          </div>
        )}
      </Card>
    </main>
  );
}
