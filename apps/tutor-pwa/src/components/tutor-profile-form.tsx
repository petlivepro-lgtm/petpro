"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AddressFields, Button, Card, Input, Label, PhoneInput } from "@mylivepet/ui";
import type { AddressParts } from "@mylivepet/types";
import { updateTutorProfile, type FormState } from "@/app/(app)/configuracoes/actions";

export type TutorProfile = AddressParts & {
  full_name: string;
  email: string;
  phone: string;
};

export function TutorProfileForm({ tutor }: { tutor: TutorProfile }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateTutorProfile,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="full_name">Nome *</Label>
          <Input id="full_name" name="full_name" required defaultValue={tutor.full_name} placeholder="Seu nome" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <PhoneInput id="phone" name="phone" defaultValue={tutor.phone} />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={tutor.email} placeholder="email@exemplo.com" />
          </div>
        </div>

        {/* O endereço é editável pelo próprio tutor porque é o único dado do
            cadastro que muda sozinho: ele se muda e o petshop não fica
            sabendo. É também o que libera o leva e traz no agendamento. */}
        <AddressFields idPrefix="tutor-perfil" defaultValues={tutor} />

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {saved && <p className="text-sm text-success">Alterações salvas.</p>}

        <div className="flex justify-end pt-1">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
