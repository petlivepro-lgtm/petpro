"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, FileInput, Input, Label } from "@mylivepet/ui";
import { updateTenantSettings, type FormState } from "./actions";

export type TenantSettings = {
  name: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
};

export function SettingsForm({ tenant }: { tenant: TenantSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateTenantSettings,
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
    <Card className="max-w-2xl p-6">
      <form action={formAction} className="space-y-5">
        <div>
          <Label htmlFor="logo">Logo do petshop</Label>
          <FileInput id="logo" name="logo" previewSrc={tenant.logoUrl} />
          <p className="mt-1 text-xs text-gray-neutral">
            Aparece como ícone ao lado do nome do petshop. PNG, JPG ou WEBP.
          </p>
        </div>

        <div>
          <Label htmlFor="name">Nome do petshop *</Label>
          <Input id="name" name="name" required defaultValue={tenant.name} placeholder="Ex.: PetShop Feliz" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" name="phone" defaultValue={tenant.phone} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" defaultValue={tenant.email} placeholder="contato@petshop.com" />
          </div>
        </div>

        <div>
          <Label htmlFor="address">Endereço</Label>
          <Input id="address" name="address" defaultValue={tenant.address} placeholder="Rua, número, bairro, cidade" />
        </div>

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
