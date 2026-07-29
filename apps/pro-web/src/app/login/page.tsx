"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, PasswordInput } from "@mylivepet/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso não pertence ao painel do petshop."
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
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

    router.replace("/");
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
            Acessar painel
          </h1>
          <p className="mt-1 text-sm text-gray-neutral">
            Gestão profissional do cuidado pet.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
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
          {(error ?? accessError) && (
            <p className="text-sm text-danger">{error ?? accessError}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
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
      </Card>
    </main>
  );
}
