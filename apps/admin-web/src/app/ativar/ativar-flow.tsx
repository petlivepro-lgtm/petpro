"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button, Label, PasswordInput, PasswordRules } from "@mylivepet/ui";
import {
  ADMIN_PASSWORD_MAX,
  ADMIN_PASSWORD_MIN,
  ADMIN_PASSWORD_RULES,
  failedPasswordRules,
} from "@/lib/password-policy";
import { claimInvite, setActivationPassword } from "./actions";

type Phase = { kind: "reading" } | { kind: "error"; message: string } | { kind: "missing" };

/**
 * Lê a sessão que o Supabase pôs no fragmento da URL (#access_token=...) e o
 * token do convite (?convite=...), apaga os dois da barra de endereço na hora
 * e entrega ao servidor. O fragmento nunca chega ao servidor sozinho.
 */
export function ClaimFromLink() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    window.history.replaceState(null, "", window.location.pathname);

    if (hash.get("error") || hash.get("error_code")) {
      setPhase({
        kind: "error",
        message: "Este link expirou ou já foi usado. Peça um novo convite a um superadmin.",
      });
      return;
    }
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const convite = query.get("convite");
    if (!accessToken || !refreshToken || !convite) {
      setPhase({ kind: "missing" });
      return;
    }
    claimInvite({ convite, accessToken, refreshToken }).then((res) => {
      if (res.ok) router.refresh();
      else setPhase({ kind: "error", message: res.error });
    });
  }, [router]);

  if (phase.kind === "reading") {
    return (
      <p className="flex items-center gap-3 text-[15px] text-gray-neutral">
        <Loader2 className="h-5 w-5 animate-spin text-petrol" aria-hidden /> Conferindo o convite…
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium leading-relaxed text-[#9A3825]">
      {phase.kind === "missing"
        ? "Abra o link do convite que chegou no seu e-mail. Este endereço sozinho não ativa nada."
        : phase.message}
    </p>
  );
}

export function NewPasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const failed = failedPasswordRules(password, email);
  const mismatch = confirm.length > 0 && confirm !== password;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (failed.length || password !== confirm) return;
    setError(null);
    start(async () => {
      const res = await setActivationPassword(password, confirm);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-graphite/80">
        Conta: <strong className="font-semibold text-graphite">{email}</strong>
      </p>
      <div>
        <Label htmlFor="new-password">Senha nova</Label>
        <PasswordInput
          id="new-password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={ADMIN_PASSWORD_MIN}
          maxLength={ADMIN_PASSWORD_MAX}
          aria-describedby="password-rules"
          aria-invalid={password.length > 0 && failed.length > 0}
          className="focus-visible:ring-petrol"
        />
        <PasswordRules id="password-rules" rules={ADMIN_PASSWORD_RULES} password={password} email={email} />
      </div>
      <div>
        <Label htmlFor="confirm-password">Repita a senha</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          aria-invalid={mismatch}
          aria-describedby={mismatch ? "confirm-hint" : undefined}
          className="focus-visible:ring-petrol"
        />
        {mismatch && (
          <p id="confirm-hint" className="mt-1.5 text-xs font-medium text-[#9A3825]">
            As duas senhas ainda não são iguais.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || failed.length > 0 || password !== confirm}
        className="h-12 bg-petrol text-[15px] font-semibold hover:bg-petrol/90 focus-visible:ring-petrol"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" /> : "Salvar senha e continuar"}
      </Button>
      <p className="text-[13px] leading-relaxed text-gray-neutral">
        Ao salvar, outras sessões desta conta são encerradas e qualquer app autenticador antigo é
        desligado. O próximo passo é ligar o seu.
      </p>
    </form>
  );
}
