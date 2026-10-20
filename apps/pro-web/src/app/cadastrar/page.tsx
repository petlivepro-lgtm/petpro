"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Card,
  Input,
  Label,
  PasswordInput,
  PhoneInput,
  cn,
} from "@mylivepet/ui";
import {
  failedPetshopPasswordRules,
  PETSHOP_PASSWORD_MAX,
  PETSHOP_PASSWORD_MIN,
  PETSHOP_PASSWORD_RULES,
} from "@mylivepet/types";
import { registerPetshop } from "./actions";

export default function CadastrarPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const failed = failedPetshopPasswordRules(password, email);
  const petshopNameRef = useRef<HTMLInputElement>(null);

  // A landing (petlivepro.com.br) manda o nome digitado em ?petshop=.
  // Lido no cliente para não exigir Suspense em volta de useSearchParams.
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("petshop")?.trim();
    const input = petshopNameRef.current;
    if (name && input && !input.value) input.value = name.slice(0, 80);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (failed.length) return;
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setLoading(false);
      // Conta criada, mas o login automático falhou — manda para o login.
      router.replace("/login");
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
            Cadastrar petshop
          </h1>
          <p className="mt-1 text-sm text-gray-neutral">
            Crie sua conta e comece a gerenciar o cuidado pet.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="petshop_name">Nome do petshop</Label>
            <Input
              ref={petshopNameRef}
              id="petshop_name"
              name="petshop_name"
              required
              placeholder="Ex.: Petshop do Bairro"
            />
          </div>
          <div>
            <Label htmlFor="full_name">Seu nome</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              placeholder="Ex.: Maria Silva"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <PhoneInput id="phone" name="phone" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
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
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PETSHOP_PASSWORD_MIN}
              maxLength={PETSHOP_PASSWORD_MAX}
              aria-describedby="password-rules"
              aria-invalid={password.length > 0 && failed.length > 0}
            />
            <ul id="password-rules" aria-label="Regras da senha" className="mt-2.5 grid gap-1.5">
              {PETSHOP_PASSWORD_RULES.map((rule) => {
                const ok = rule.test(password, email);
                return (
                  <li
                    key={rule.id}
                    className={cn(
                      "flex items-center gap-2 text-xs transition-colors duration-150",
                      ok ? "font-medium text-[#22603F]" : "text-gray-neutral",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-4 w-4 shrink-0 place-items-center rounded-full transition-colors duration-150",
                        ok ? "bg-success text-white" : "border border-graphite/25",
                      )}
                    >
                      {ok && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                    </span>
                    {rule.label}
                    <span className="sr-only">{ok ? " (cumprida)" : " (falta)"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || failed.length > 0}>
            {loading ? "Criando..." : "Cadastrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-neutral">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-medium text-orange hover:underline"
          >
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
