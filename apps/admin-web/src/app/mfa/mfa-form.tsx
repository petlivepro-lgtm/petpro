"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Loader2, QrCode } from "lucide-react";
import { Button, Input, Label } from "@mylivepet/ui";
import { startEnrollment, verifyMfa, type Enrollment } from "./actions";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

/** Campo de 6 dígitos + botão; usado no desafio e no fim do cadastro. */
function CodeField({ factorId, label }: { factorId: string; label: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6) return;
    setError(null);
    start(async () => {
      const res = await verifyMfa(factorId, code);
      if (res && !res.ok) {
        setError(res.error);
        setCode("");
        if (res.code === "AUTH") window.location.assign("/login");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="mfa-code">{label}</Label>
        <Input
          id="mfa-code"
          value={code}
          onChange={(e) => setCode(onlyDigits(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "mfa-error" : undefined}
          className="h-14 text-center font-accent text-2xl tracking-[0.45em] focus-visible:ring-petrol"
        />
      </div>
      {error && (
        <p id="mfa-error" role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#9A3825]">
          {error}
        </p>
      )}
      <Button
        type="submit"
        disabled={pending || code.length !== 6}
        className="h-12 bg-petrol text-[15px] font-semibold hover:bg-petrol/90 focus-visible:ring-petrol"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Verificando" /> : "Verificar e entrar"}
      </Button>
    </form>
  );
}

export function MfaChallenge({ factorId }: { factorId: string }) {
  return <CodeField factorId={factorId} label="Código do app autenticador" />;
}

export function MfaEnroll() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      const res = await startEnrollment();
      if (res.ok) setEnrollment(res.data);
      else setError(res.error);
    });
  }

  async function copySecret() {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!enrollment) {
    return (
      <div className="flex flex-col gap-4">
        <ol className="flex flex-col gap-3 text-sm leading-relaxed text-graphite/80">
          <li>1. Instale um app autenticador: Google Authenticator, Microsoft Authenticator ou 1Password.</li>
          <li>2. Gere o QR Code abaixo e escaneie com o app.</li>
          <li>3. Digite o código de 6 dígitos que o app mostrar.</li>
        </ol>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#9A3825]">
            {error}
          </p>
        )}
        <Button
          type="button"
          onClick={generate}
          disabled={pending}
          className="h-12 bg-petrol text-[15px] font-semibold hover:bg-petrol/90 focus-visible:ring-petrol"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-label="Gerando" /> : (
            <>
              <QrCode className="h-4 w-4" aria-hidden /> Gerar QR Code
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-graphite/10 bg-surface-muted/60 p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enrollment.qrCode}
          alt="QR Code para cadastrar o Pet Live Pro Admin no app autenticador"
          className="h-44 w-44 rounded-xl bg-white p-2"
        />
        <div className="flex w-full items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg bg-surface px-3 py-2 text-xs tracking-wider text-graphite">
            {enrollment.secret}
          </code>
          <button
            type="button"
            onClick={copySecret}
            aria-label={copied ? "Chave copiada" : "Copiar chave"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-graphite/15 bg-surface text-graphite transition-colors hover:bg-surface-muted"
          >
            {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <p className="text-center text-xs text-gray-neutral">Sem câmera? Digite a chave acima no app.</p>
      </div>
      <CodeField factorId={enrollment.factorId} label="Código que o app mostrou" />
    </div>
  );
}
