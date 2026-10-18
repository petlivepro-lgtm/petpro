"use client";

import { Input, Label } from "@mylivepet/ui";
import { SIGNUP_URL } from "@/content/links";

// Leva o nome do petshop para o formulário de cadastro do painel (?petshop=).
export function SignupForm({ id, onDark = false }: { id: string; onDark?: boolean }) {
  return (
    <form action={SIGNUP_URL} method="get" className="flex flex-col gap-2 sm:flex-row">
      <Label htmlFor={id} className="sr-only">
        Nome do seu petshop
      </Label>
      <Input
        id={id}
        name="petshop"
        autoComplete="organization"
        maxLength={80}
        placeholder="Nome do seu petshop"
        className={`h-[54px] w-full rounded-xl px-4 sm:flex-1 text-base placeholder:text-[#6b7680] ${
          onDark ? "border-0 bg-white" : "border-[#d5dbe0] bg-white"
        }`}
      />
      <button
        type="submit"
        className="h-[54px] shrink-0 rounded-xl bg-orange px-6 text-base font-bold text-graphite transition-colors duration-150 hover:bg-[#ff7d24] active:translate-y-px"
      >
        Criar conta
      </button>
    </form>
  );
}

export function Guarantees({ items, onDark = false }: { items: string[]; onDark?: boolean }) {
  return (
    <ul className={`mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-medium ${onDark ? "text-[#aab5be]" : "text-[#5d6873]"}`}>
      {items.map((g) => (
        <li key={g} className="check-dot whitespace-nowrap">
          {g}
        </li>
      ))}
    </ul>
  );
}
