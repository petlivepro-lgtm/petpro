"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Info, MapPin, MessageCircle } from "lucide-react";
import { AddressFields, Button, Card, FileInput, Input, Label, PhoneInput } from "@mylivepet/ui";
import { formatAddressLine, type AddressParts } from "@mylivepet/types";
import { updateTenantSettings, type FormState } from "./actions";
import { FormSection, PreviewFrame, SettingsSplit, TipCard } from "./settings-layout";

export type TenantSettings = {
  name: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  /** Endereço em campos (CEP, rua, número...). */
  addressParts: AddressParts | null;
  /** Texto livre de antes do CEP, enquanto ninguém preencheu os campos. */
  legacyAddress: string | null;
};

export function SettingsForm({ tenant }: { tenant: TenantSettings }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone);
  const [logo, setLogo] = useState<string | null>(tenant.logoUrl);
  const [address, setAddress] = useState<AddressParts | null>(tenant.addressParts);
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateTenantSettings, { ok: false });

  useEffect(() => {
    if (state.ok) {
      setSaved(true);
      router.refresh();
      const t = setTimeout(() => setSaved(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state, router]);

  const addressLine = formatAddressLine(address) ?? tenant.legacyAddress;

  return (
    <SettingsSplit
      aside={
        <>
          <PetshopPreview name={name} logo={logo} phone={phone} addressLine={addressLine} />
          <TipCard
            title="Onde esses dados aparecem"
            items={[
              "Logo e nome: no topo do app do tutor e nas notificações.",
              "Telefone: botão de WhatsApp na Ajuda do app, para o tutor falar direto com vocês.",
              "Endereço: saída e chegada das rotas do leva-e-traz no mapa do entregador.",
            ]}
          />
        </>
      }
    >
      <Card className="p-0">
        <form action={formAction}>
          <FormSection title="Identidade" description="Como o petshop aparece para os tutores e para a equipe.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="logo">Logo</Label>
                <FileInput id="logo" name="logo" previewSrc={tenant.logoUrl} onFileChange={(_, url) => setLogo(url)} />
                <p className="mt-1 text-xs text-gray-neutral">Quadrada fica melhor. PNG, JPG ou WEBP.</p>
              </div>
              <div>
                <Label htmlFor="name">Nome do petshop *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={tenant.name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: PetShop Feliz"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Contato" description="O telefone vira o botão de WhatsApp no app do tutor.">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="phone">Telefone / WhatsApp</Label>
                <PhoneInput id="phone" name="phone" value={phone} onChange={setPhone} />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={tenant.email} placeholder="contato@petshop.com" />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Endereço"
            description="Digite o CEP: rua, bairro, cidade e UF vêm sozinhos — complete com o número. Se o CEP não for encontrado, preencha à mão."
          >
            {tenant.legacyAddress && !tenant.addressParts && (
              <p className="flex items-start gap-2 rounded-xl bg-warning/15 px-3 py-2.5 text-[13px] text-graphite">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6418]" aria-hidden />
                <span>
                  Endereço atual: <strong className="font-semibold">{tenant.legacyAddress}</strong>. Preencha pelo CEP para
                  o mapa do leva-e-traz achar o petshop com precisão.
                </span>
              </p>
            )}
            <AddressFields idPrefix="tenant" title="" defaultValues={tenant.addressParts} onChange={setAddress} />
          </FormSection>

          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-graphite/[0.06] bg-surface/95 px-5 py-4 backdrop-blur sm:px-6">
            {state.error && (
              <p role="alert" className="mr-auto text-sm font-medium text-danger">
                {state.error}
              </p>
            )}
            {saved && (
              <p role="status" className="mr-auto flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Alterações salvas.
              </p>
            )}
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </form>
      </Card>
    </SettingsSplit>
  );
}

function PetshopPreview({
  name,
  logo,
  phone,
  addressLine,
}: {
  name: string;
  logo: string | null;
  phone: string;
  addressLine: string | null;
}) {
  return (
    <PreviewFrame>
      <div className="space-y-2.5">
        <div className="rounded-2xl bg-surface p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logopet.svg" alt="" className="h-7 w-auto" />
          <div className="mt-2.5 flex min-w-0 items-center gap-2.5">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-10 w-10 shrink-0 rounded-xl border border-graphite/10 bg-surface object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange/10 text-orange">
                <Building2 className="h-5 w-5" />
              </span>
            )}
            <p className="truncate text-sm font-medium text-graphite">{name.trim() || "Nome do petshop"}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-surface p-3">
          <p className="text-xs font-semibold text-gray-neutral">Ajuda › Falar com o petshop</p>
          {phone.replace(/\D/g, "").length >= 10 ? (
            <span className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4" /> Chamar no WhatsApp
            </span>
          ) : (
            <p className="mt-1.5 text-xs leading-relaxed text-gray-neutral">Sem telefone, o tutor não tem como chamar vocês pelo app.</p>
          )}
        </div>

        <div className="rounded-2xl bg-surface p-3">
          <p className="text-xs font-semibold text-gray-neutral">Rota do leva-e-traz</p>
          <p className="mt-1.5 flex items-start gap-2 text-[13px] leading-snug text-graphite">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
            {addressLine ?? <span className="text-gray-neutral">Endereço não informado</span>}
          </p>
        </div>
      </div>
    </PreviewFrame>
  );
}
