"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button, NewPasswordFields } from "@mylivepet/ui";
import { failedPasswordRules, PASSWORD_MAX, PASSWORD_RULES } from "@mylivepet/types";
import { createClient } from "@/lib/supabase/client";

/**
 * Troca de senha com a sessão atual — as mesmas regras da criação de senha
 * (ver redefinir-senha). Fica recolhida: quase ninguém abre Configurações
 * para isso, e os dois campos abertos pareceriam obrigatórios.
 */
export function SettingsPassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  // Só para a regra "não conter o seu e-mail"; conta de telefone tem e-mail técnico.
  useEffect(() => {
    if (!open) return;
    void createClient()
      .auth.getUser()
      .then(({ data: { user } }) =>
        setEmail(user?.user_metadata?.phone_login ? undefined : (user?.email ?? undefined)),
      );
  }, [open]);

  const invalid = failedPasswordRules(password, email).length > 0 || password !== confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (invalid) return;

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Não foi possível trocar a senha. Saia, entre de novo e tente outra vez.");
      return;
    }
    setPassword("");
    setConfirm("");
    setOpen(false);
    setSaved(true);
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-petrol/[0.07] text-petrol">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-graphite">Senha de acesso</p>
          <p className={saved ? "text-sm text-success" : "text-sm text-gray-neutral"}>
            {saved ? "Senha trocada. Use a nova no próximo acesso." : "Troque quando quiser — a sessão atual continua aberta."}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="shrink-0"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          Trocar senha
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm font-medium text-graphite">Nova senha</p>
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
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setPassword("");
            setConfirm("");
            setError(null);
          }}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || invalid}>
          {loading ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </div>
    </form>
  );
}
