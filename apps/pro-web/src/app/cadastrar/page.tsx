"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Label, PhoneInput } from "@mylivepet/ui";
import { registerPetshop } from "./actions";

export default function CadastrarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const res = await registerPetshop(formData);
    if (!res.ok) {
      setLoading(false);
      setError(res.error ?? "Não foi possível concluir o cadastro.");
      return;
    }

    // Loga automaticamente com as credenciais recém-criadas.
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      // Conta criada, mas o login automático falhou — manda para o login.
      router.replace("/login");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <div className="mb-6">
          <img src="/brand/logopet.svg" alt="Pet Live Pro" className="mb-2 h-11 w-auto" />
          <h1 className="font-heading text-2xl font-bold text-graphite">Cadastrar petshop</h1>
          <p className="mt-1 text-sm text-gray-neutral">
            Crie sua conta e comece a gerenciar o cuidado pet.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="petshop_name">Nome do petshop</Label>
            <Input id="petshop_name" name="petshop_name" required placeholder="Ex.: Petshop do Bairro" />
          </div>
          <div>
            <Label htmlFor="full_name">Seu nome</Label>
            <Input id="full_name" name="full_name" required placeholder="Ex.: Maria Silva" />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <PhoneInput id="phone" name="phone" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Cadastrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-neutral">
          Já tem conta?{" "}
          <Link href="/login" className="font-medium text-orange hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
