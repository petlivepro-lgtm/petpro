"use client";

import * as React from "react";
import { cn } from "./cn";
import { Label } from "./input";
import { PasswordInput } from "./password-input";

/** Mesmo formato das regras de @mylivepet/types e do admin-web: quem passa as regras é o app. */
export type PasswordRuleView = {
  id: string;
  label: string;
  test: (password: string, email?: string) => boolean;
};

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/**
 * Regras da senha marcando enquanto a pessoa digita (padrão do admin). É só
 * conforto: quem recusa de verdade é o servidor, com as MESMAS regras.
 */
export function PasswordRules({
  rules,
  password,
  email,
  id,
  columns = 2,
  className,
}: {
  rules: PasswordRuleView[];
  password: string;
  email?: string;
  id?: string;
  /** 1 em telas estreitas (cartão de login), 2 onde cabe. */
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <ul id={id} aria-label="Regras da senha" className={cn("mt-2.5 grid gap-1.5", columns === 2 && "sm:grid-cols-2", className)}>
      {rules.map((rule) => {
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
              {ok && <CheckIcon />}
            </span>
            {rule.label}
            <span className="sr-only">{ok ? " (cumprida)" : " (falta)"}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Senha nova + confirmação, com as regras marcando ao digitar e o aviso de
 * "não são iguais". Controlado: o formulário guarda os dois valores e decide
 * se pode enviar (`failed...Rules(password).length === 0 && password === confirm`).
 */
export function NewPasswordFields({
  rules,
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  email,
  idPrefix = "new",
  label = "Nova senha",
  confirmLabel = "Confirmar senha",
  name,
  minLength,
  maxLength,
  columns = 1,
  inputClassName,
  autoFocus,
}: {
  rules: PasswordRuleView[];
  password: string;
  confirm: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  /** Para a regra "não conter o seu e-mail". */
  email?: string;
  idPrefix?: string;
  label?: string;
  confirmLabel?: string;
  /** `name` do campo da senha, quando o formulário envia por FormData. */
  name?: string;
  minLength?: number;
  maxLength?: number;
  columns?: 1 | 2;
  inputClassName?: string;
  autoFocus?: boolean;
}) {
  const failed = rules.filter((rule) => !rule.test(password, email));
  const mismatch = confirm.length > 0 && confirm !== password;
  const rulesId = `${idPrefix}-password-rules`;
  const hintId = `${idPrefix}-confirm-hint`;

  return (
    <>
      <div>
        <Label htmlFor={`${idPrefix}-password`}>{label}</Label>
        <PasswordInput
          id={`${idPrefix}-password`}
          name={name}
          autoComplete="new-password"
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          required
          minLength={minLength}
          maxLength={maxLength}
          autoFocus={autoFocus}
          aria-describedby={rulesId}
          aria-invalid={password.length > 0 && failed.length > 0}
          className={inputClassName}
        />
        <PasswordRules id={rulesId} rules={rules} password={password} email={email} columns={columns} />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-confirm`}>{confirmLabel}</Label>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          required
          aria-invalid={mismatch}
          aria-describedby={mismatch ? hintId : undefined}
          className={inputClassName}
        />
        {mismatch && (
          <p id={hintId} className="mt-1.5 text-xs font-medium text-danger">
            As duas senhas ainda não são iguais.
          </p>
        )}
        {!mismatch && confirm.length > 0 && failed.length === 0 && (
          <p className="mt-1.5 text-xs font-medium text-[#22603F]">As senhas conferem.</p>
        )}
      </div>
    </>
  );
}
