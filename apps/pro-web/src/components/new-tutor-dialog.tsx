"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus } from "lucide-react";
import { Button, Dialog, Input, Label, Select, PhoneInput, DatePicker } from "@mylivepet/ui";
import { SPECIES_OPTIONS } from "@mylivepet/types";
import { createTutor, type FormState } from "@/app/(app)/tutores/actions";

export function NewTutorDialog({
  trigger = "button",
}: {
  trigger?: "button" | "cta";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [createAccess, setCreateAccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(createTutor, { ok: false });

  useEffect(() => {
    // Quando um acesso é criado, mantém o diálogo aberto para mostrar a senha.
    if (state.ok && !state.access) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function close() {
    setOpen(false);
    setCreateAccess(false);
    setCopied(false);
    router.refresh();
  }

  return (
    <>
      {trigger === "button" ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo tutor
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Cadastrar primeiro tutor
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => (v ? setOpen(true) : close())}
        title="Novo tutor"
        description="Cadastre o cliente e, se quiser, já o primeiro pet."
      >
        {state.access ? (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              Acesso ao app <span className="font-semibold">MyLivePet</span> criado. Compartilhe os
              dados abaixo com o tutor — ele definirá a própria senha no primeiro acesso.
            </p>
            <div className="rounded-xl border border-graphite/15 bg-surface p-4 text-sm">
              <p className="text-gray-neutral">E-mail</p>
              <p className="font-medium text-graphite">{state.access.email}</p>
              <p className="mt-3 text-gray-neutral">Senha temporária</p>
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-base font-semibold text-graphite">
                  {state.access.password}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(state.access!.password);
                    setCopied(true);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="button" onClick={close}>
                Concluir
              </Button>
            </div>
          </div>
        ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="full_name">Nome do tutor *</Label>
            <Input id="full_name" name="full_name" required placeholder="Ex.: Maria Silva" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput id="phone" name="phone" />
            </div>
            <div>
              <Label htmlFor="email">E-mail{createAccess ? " *" : ""}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="email@exemplo.com"
                required={createAccess}
              />
            </div>
          </div>
          {/* valor enviado reflete o estado do React (não depende da serialização do checkbox) */}
          <input type="hidden" name="create_access" value={createAccess ? "on" : ""} />
          <label className="flex items-start gap-2 rounded-xl border border-graphite/15 bg-surface p-3 text-sm">
            <input
              type="checkbox"
              checked={createAccess}
              onChange={(e) => setCreateAccess(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-orange"
            />
            <span>
              <span className="font-medium text-graphite">Criar acesso ao app MyLivePet</span>
              <span className="block text-gray-neutral">
                Gera uma senha temporária para o tutor. Exige e-mail.
              </span>
            </span>
          </label>
          <div>
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" name="notes" placeholder="Opcional" />
          </div>

          <div className="rounded-xl border border-dashed border-graphite/15 p-4">
            <p className="mb-3 text-sm font-semibold text-graphite">Primeiro pet (opcional)</p>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pet_name">Nome do pet</Label>
                  <Input id="pet_name" name="pet_name" placeholder="Ex.: Thor" />
                </div>
                <div>
                  <Label htmlFor="pet_size">Porte</Label>
                  <Select id="pet_size" name="pet_size" defaultValue="">
                    <option value="">—</option>
                    <option value="pequeno">Pequeno</option>
                    <option value="medio">Médio</option>
                    <option value="grande">Grande</option>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="pet_species">Espécie</Label>
                  <Select id="pet_species" name="pet_species" defaultValue="">
                    <option value="">—</option>
                    {SPECIES_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pet_breed">Raça</Label>
                  <Input id="pet_breed" name="pet_breed" placeholder="Opcional" />
                </div>
              </div>
              <div>
                <Label htmlFor="pet_birth_date">Nascimento</Label>
                <DatePicker id="pet_birth_date" name="pet_birth_date" mode="date" />
              </div>
            </div>
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
        )}
      </Dialog>
    </>
  );
}
