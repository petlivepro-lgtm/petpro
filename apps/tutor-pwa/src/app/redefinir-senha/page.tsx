"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, NewPasswordFields } from "@mylivepet/ui";
import { failedPasswordRules, PASSWORD_MAX, PASSWORD_RULES } from "@mylivepet/types";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState<string | undefined>();

  // Só para a regra "não conter o seu e-mail"; conta de telefone tem e-mail técnico.
  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setEmail(user?.user_metadata?.phone_login ? undefined : (user?.email ?? undefined)));
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (failedPasswordRules(password, email).length || password !== confirm) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_reset_password: false },
    });
    setLoading(false);
    if (error) {
      setError("Não foi possível salvar a senha. Tente novamente.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <img
          src="/brand/logopet.svg"
          alt="Pet Live Pro"
          className="mx-auto h-24 w-auto"
        />
        <h1 className="mt-1 font-heading text-2xl font-bold text-graphite">
          Defina sua senha de acesso
        </h1>
        <p className="mt-1 text-sm text-gray-neutral">
          Para sua segurança, escolha uma nova senha antes de continuar.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <NewPasswordFields
          rules={PASSWORD_RULES}
          password={password}
          confirm={confirm}
          onPasswordChange={setPassword}
          onConfirmChange={setConfirm}
          email={email}
          maxLength={PASSWORD_MAX}
          autoFocus
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          className="w-full"
          disabled={loading || failedPasswordRules(password, email).length > 0 || password !== confirm}
        >
          {loading ? "Salvando..." : "Salvar senha"}
        </Button>
      </form>
    </main>
  );
}
