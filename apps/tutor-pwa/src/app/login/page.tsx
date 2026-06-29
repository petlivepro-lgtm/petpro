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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const accessError =
    searchParams.get("erro") === "acesso"
      ? "Este acesso nao pertence ao app MyLivePet."
      : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError("E-mail ou senha inválidos.");
      return;
    }
    const userId = data.user?.id;
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
      setLoading(false);
      setError("Você não tem permissão para acessar.");
      return;
    }

    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img src="/brand/logopet.svg" alt="MyLivePet" className="mx-auto h-24 w-auto" />
        <h1 className="mt-1 font-heading text-2xl font-bold text-graphite">Bem-vindo de volta</h1>
        <p className="mt-1 text-sm text-gray-neutral">
          Acompanhe o cuidado do seu pet com tranquilidade.
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
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {(error ?? accessError) && <p className="text-sm text-danger">{error ?? accessError}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </main>
  );
}
