"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@mylivepet/ui";

type Phase = "checking" | "form" | "error";

export default function CriarSenhaPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // O link mágico autentica ao abrir a página; então vinculamos a ficha de
  // tutor (claim) e liberamos o formulário de criação de senha.
  useEffect(() => {
    let done = false;
    async function finish() {
      if (done) return;
      done = true;
      await supabase.rpc("claim_tutor_access");
      setPhase("form");
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    const timeout = setTimeout(() => {
      if (!done) setPhase("error");
    }, 5000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img src="/brand/logopet.svg" alt="MyLivePet" className="mx-auto h-24 w-auto" />
        <h1 className="mt-1 font-heading text-2xl font-bold text-graphite">Crie sua senha</h1>
        <p className="mt-1 text-sm text-gray-neutral">
          Defina uma senha para os próximos acessos ao app.
        </p>
      </div>

      {phase === "checking" && (
        <p className="text-center text-sm text-gray-neutral">Validando seu acesso...</p>
      )}

      {phase === "error" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-danger">
            Link inválido ou expirado. Solicite um novo link de acesso.
          </p>
          <Link href="/login">
            <Button className="w-full">Voltar para o login</Button>
          </Link>
        </div>
      )}

      {phase === "form" && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
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
