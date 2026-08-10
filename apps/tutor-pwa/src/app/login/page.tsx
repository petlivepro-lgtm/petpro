"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPhoneBR, isValidPhoneBR, phoneDigits } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Label,
  PasswordInput,
  PhoneInput,
  cn,
} from "@mylivepet/ui";
import {
  activateTutorAccess,
  sendTutorResetLink,
  signInTutor,
  type Identifier,
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
 * identify : digita e-mail ou telefone (passo 1, decide o resto)
 * create   : primeiro acesso — define a senha aqui mesmo
 * login    : já tem senha
 * sent     : link de redefinição enviado por e-mail
 */
type Step = "identify" | "create" | "login" | "sent";
type Mode = "email" | "phone";

type LoginStatus = {
  status: "not_found" | "first_access" | "existing" | "ambiguous";
  kind: Mode;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const [step, setStep] = useState<Step>("identify");
  const [mode, setMode] = useState<Mode>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [loading, setLoading] = useState(false);

  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso nao pertence ao app MyLivePet."
      : null;

  /** O que o tutor digitou, no formato que as Server Actions esperam. */
  const identifier: Identifier =
    mode === "email"
      ? { kind: "email", value: email.trim().toLowerCase() }
      : { kind: "phone", value: phoneDigits(phone) };

  /** Rótulo do identificador nas telas seguintes (readonly). */
  const identifierLabel = mode === "email" ? "E-mail" : "Telefone";
  const identifierText = mode === "email" ? email.trim() : formatPhoneBR(phone);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  /** Link por e-mail — usado só para redefinir senha esquecida. */
  async function sendResetLink() {
    setLoading(true);
    setError(null);
    setNotice(null);
    const result = await sendTutorResetLink(identifier);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSentTo(result.email);
    setStep("sent");
  }

  // Passo 1: identifica o estado do cadastro e direciona o fluxo.
  async function onSubmitIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "phone" && !isValidPhoneBR(identifier.value)) {
      setError("Digite o DDD e o número do telefone.");
      return;
    }

    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("tutor_login_status", {
      p_identifier: identifier.value,
    });
    setLoading(false);
    if (rpcError) {
      setError("Não foi possível verificar seu cadastro. Tente novamente.");
      return;
    }
    const result = data as unknown as LoginStatus;
    if (result.status === "ambiguous") {
      setError(
        "Este telefone está em mais de um cadastro. Entre com seu e-mail ou fale com o petshop.",
      );
      setMode("email");
      return;
    }
    if (result.status === "not_found") {
      setError(
        mode === "phone"
          ? "Telefone não encontrado. Procure o petshop para se cadastrar."
          : "E-mail não encontrado. Procure o petshop para se cadastrar.",
      );
      return;
    }
    // 'existing' => já tem senha, só entrar. 'first_access' => criar a senha aqui.
    setStep(result.status === "existing" ? "login" : "create");
  }

  // Passo 2 (first_access): cria a senha e devolve para a tela de login.
  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(
        `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      );
      return;
    }
    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const result = await activateTutorAccess(identifier, newPassword);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNewPassword("");
    setConfirm("");
    setPassword("");
    setNotice("Senha criada com sucesso. Agora entre com ela.");
    setStep("login");
  }

  // Passo 2 (existing): login de quem já tem senha. A sessão é criada na
  // Server Action — por telefone, só o servidor sabe qual conta autenticar.
  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const result = await signInTutor(identifier, password);
    if (!result.ok) {
      setLoading(false);
      setError(result.error);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  function backToIdentify() {
    setError(null);
    setNotice(null);
    setStep("identify");
  }

  const headings: Record<Step, { title: string; subtitle: string }> = {
    identify: {
      title: "Bem-vindo",
      subtitle: "Informe seu e-mail ou telefone para acessar o app.",
    },
    create: {
      title: "Primeiro acesso",
      subtitle: "Crie a senha que você vai usar no app.",
    },
    login: {
      title: "Bem-vindo de volta",
      subtitle: "Digite sua senha para entrar.",
    },
    sent: {
      title: "Verifique seu e-mail",
      subtitle: "Enviamos um link de acesso para você.",
    },
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img
          src="/brand/logopet.svg"
          alt="MyLivePet"
          className="mx-auto h-24 w-auto"
        />
        <h1 className="mt-1 font-heading text-2xl font-bold text-graphite">
          {headings[step].title}
        </h1>
        <p className="mt-1 text-sm text-gray-neutral">
          {headings[step].subtitle}
        </p>
      </div>

      {step === "identify" && (
        <form onSubmit={onSubmitIdentify} className="space-y-4">
          <div
            role="tablist"
            aria-label="Como você quer entrar"
            className="grid grid-cols-2 gap-1 rounded-xl bg-graphite/5 p-1"
          >
            {(
              [
                { value: "email", label: "E-mail" },
                { value: "phone", label: "Telefone" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                onClick={() => switchMode(tab.value)}
                className={cn(
                  "h-9 rounded-lg text-sm font-medium transition-colors",
                  mode === tab.value
                    ? "bg-surface text-graphite shadow-sm"
                    : "text-gray-neutral",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === "email" ? (
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
          ) : (
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput
                id="phone"
                value={phone}
                onChange={setPhone}
                required
              />
              <p className="mt-1 text-xs text-gray-neutral">
                Digite o DDD e o número, como no cadastro do petshop.
              </p>
            </div>
          )}

          {(error ?? accessError) && (
            <p className="text-sm text-danger">{error ?? accessError}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Verificando..." : "Continuar"}
          </Button>
        </form>
      )}

      {step === "create" && (
        <form onSubmit={onSubmitCreate} className="space-y-4">
          <div>
            <Label htmlFor="identifier-new">{identifierLabel}</Label>
            <Input id="identifier-new" value={identifierText} disabled />
          </div>
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
              Pelo menos {MIN_PASSWORD_LENGTH} caracteres.
            </p>
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando senha..." : "Criar senha"}
          </Button>
          <div className="text-center">
            <button
              type="button"
              className="text-sm text-gray-neutral underline"
              onClick={backToIdentify}
            >
              Usar outro acesso
            </button>
          </div>
        </form>
      )}

      {step === "login" && (
        <form onSubmit={onSubmitLogin} className="space-y-4">
          <div>
            <Label htmlFor="identifier-ro">{identifierLabel}</Label>
            <Input id="identifier-ro" value={identifierText} disabled />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {notice && <p className="text-sm text-success">{notice}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-gray-neutral underline"
              onClick={backToIdentify}
            >
              Usar outro acesso
            </button>
            <button
              type="button"
              className="text-orange underline"
              onClick={sendResetLink}
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
            Enviamos um link para{" "}
            <span className="font-medium text-graphite">{sentTo}</span>. Abra o
            e-mail e clique no link para redefinir sua senha e entrar.
          </p>
          {error && <p className="text-sm text-danger">{error}</p>}
          <button
            type="button"
            className="text-sm text-orange underline"
            onClick={sendResetLink}
            disabled={loading}
          >
            {loading ? "Reenviando..." : "Reenviar link"}
          </button>
          <div>
            <button
              type="button"
              className="text-sm text-gray-neutral underline"
              onClick={backToIdentify}
            >
              Usar outro acesso
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
