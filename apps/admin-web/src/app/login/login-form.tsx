"use client";

import { useActionState } from "react";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { Button, Input, Label, PasswordInput } from "@mylivepet/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {(state?.error || notice) && (
        <p
          role="alert"
          className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#9A3825]"
        >
          {state?.error ?? notice}
        </p>
      )}
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          autoFocus
          className="focus-visible:ring-petrol"
        />
      </div>
      <div>
        <Label htmlFor="password">Senha</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          className="focus-visible:ring-petrol"
        />
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="h-12 bg-petrol text-[15px] font-semibold hover:bg-petrol/90 focus-visible:ring-petrol"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-label="Entrando" />
        ) : (
          <>
            Continuar com segurança <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </Button>
      <p className="flex gap-2.5 rounded-xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-graphite/75">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Erros mostram sempre a mesma mensagem. Depois de 5 tentativas erradas, o acesso fica
        bloqueado por 15 minutos.
      </p>
    </form>
  );
}
