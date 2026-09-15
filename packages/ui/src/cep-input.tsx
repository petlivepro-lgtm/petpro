"use client";

import * as React from "react";
import { cepDigits, formatCep, isValidCep } from "@mylivepet/types";
import { cn } from "./cn";

/** O que o ViaCEP devolve e o formulário sabe preencher. */
export type ResolvedAddress = {
  street: string;
  district: string;
  city: string;
  state: string;
};

type Props = {
  name?: string;
  defaultValue?: string | null;
  /** Modo controlado: passe value + onChange (recebe o valor já mascarado). */
  value?: string;
  onChange?: (value: string) => void;
  /** Chamado quando o CEP completo é encontrado, com rua/bairro/cidade/UF. */
  onResolved?: (address: ResolvedAddress) => void;
  required?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

type Lookup = "idle" | "loading" | "notFound" | "offline";

/**
 * Campo de CEP com máscara 00000-000 e busca no ViaCEP.
 *
 * Ao completar os 8 dígitos consulta o endereço e entrega em `onResolved`,
 * para o formulário preencher rua, bairro, cidade e UF. A busca é uma
 * conveniência, nunca um bloqueio: se a rede do petshop recusar a chamada, o
 * campo avisa e todo o resto do endereço continua digitável à mão.
 *
 * Funciona uncontrolled (name + defaultValue, para <form action={...}>) ou
 * controlled (value + onChange). Quem corta em 8 dígitos é formatCep, para a
 * regra viver num lugar só — o mesmo arranjo do CpfInput.
 */
export function CepInput({
  name,
  defaultValue,
  value,
  onChange,
  onResolved,
  required,
  placeholder = "00000-000",
  id,
  className,
}: Props) {
  const [internal, setInternal] = React.useState(() => formatCep(defaultValue ?? ""));
  const controlled = value !== undefined;
  const current = controlled ? formatCep(value) : internal;
  const digits = cepDigits(current);

  const [lookup, setLookup] = React.useState<Lookup>("idle");

  // O callback é recriado a cada render do pai; quem dispara a busca é o CEP.
  const latestOnResolved = React.useRef(onResolved);
  latestOnResolved.current = onResolved;

  // O CEP que veio gravado não é consultado: o endereço já está no banco, e
  // sobrescrevê-lo apagaria a correção que alguém fez à mão.
  const alreadyLookedUp = React.useRef(cepDigits(defaultValue ?? value ?? ""));

  React.useEffect(() => {
    if (!isValidCep(digits) || digits === alreadyLookedUp.current) return;
    alreadyLookedUp.current = digits;

    const controller = new AbortController();
    setLookup("loading");
    fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("http"))))
      .then((data) => {
        if (data?.erro) {
          setLookup("notFound");
          return;
        }
        setLookup("idle");
        latestOnResolved.current?.({
          street: data.logradouro ?? "",
          district: data.bairro ?? "",
          city: data.localidade ?? "",
          state: (data.uf ?? "").toUpperCase(),
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Libera o mesmo CEP para nova tentativa: quem perdeu a consulta por
        // rede quer tentar de novo digitando o número outra vez.
        alreadyLookedUp.current = "";
        setLookup("offline");
      });

    return () => controller.abort();
  }, [digits]);

  return (
    <div>
      <input
        id={id}
        name={name}
        required={required}
        inputMode="numeric"
        autoComplete="postal-code"
        value={current}
        onChange={(e) => {
          const next = formatCep(e.target.value);
          if (!controlled) setInternal(next);
          if (lookup !== "idle") setLookup("idle");
          onChange?.(next);
        }}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-xl border border-graphite/15 bg-surface px-3 text-sm text-graphite",
          "placeholder:text-gray-neutral/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange",
          className,
        )}
      />
      {lookup !== "idle" && (
        <p
          role="status"
          className={cn(
            "mt-1 text-xs",
            lookup === "notFound" ? "text-danger" : "text-gray-neutral",
          )}
        >
          {lookup === "loading"
            ? "Buscando endereço..."
            : lookup === "notFound"
              ? "CEP não encontrado — preencha o endereço à mão."
              : "Não deu para consultar o CEP agora — preencha o endereço à mão."}
        </p>
      )}
    </div>
  );
}
