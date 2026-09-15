"use client";

import { useRef, useState } from "react";
import {
  formatAddressLine,
  formatCep,
  hasAddress,
  UF_OPTIONS,
  type AddressParts,
} from "@mylivepet/types";
import { CepInput } from "./cep-input";
import { Checkbox } from "./checkbox";
import { Input, Label } from "./input";
import { Select } from "./select";

/**
 * Pin desenhado à mão, e não importado do lucide: o design system não depende
 * de `lucide-react` de propósito (ver notification-bell.tsx). Aqui o ícone é
 * decorativo e é um só — obrigar cada app a injetá-lo por prop, como o sino
 * faz com os dele, seria cerimônia para enfeitar uma linha de ajuda.
 */
function PinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/**
 * Bloco de endereço dos cadastros de tutor e de pet (migração 0059).
 *
 * Mora num componente só porque os quatro diálogos do painel (novo/editar
 * tutor, novo/editar pet) e o perfil do tutor no app precisam do mesmo
 * comportamento: o CEP busca o endereço e preenche rua, bairro, cidade e UF, e
 * o foco pula para o número — o único campo que o CEP nunca sabe.
 *
 * Está no design system, e não num dos apps, porque o tutor também edita o
 * próprio endereço (tutor-pwa): é o único dado do cadastro que muda sozinho —
 * o tutor se muda e o petshop não fica sabendo — e leva-e-traz com endereço
 * velho é entregador na porta errada.
 *
 * Com `tutorAddress`, o bloco vira o do pet: começa marcado como "mesmo
 * endereço do tutor" e só abre os campos quando alguém desmarca. Marcado, os
 * inputs nem são renderizados, então a submissão não manda nada e as colunas
 * ficam nulas — que é exatamente como o banco representa "mora com o tutor".
 */
export function AddressFields({
  prefix = "",
  idPrefix,
  defaultValues,
  tutorAddress,
  inheritNote,
  title = "Endereço",
}: {
  /** Prefixo dos `name` dos campos — "pet_" quando o pet vem no mesmo form. */
  prefix?: string;
  /** Prefixo dos `id`, para não colidir com outro bloco na mesma página. */
  idPrefix: string;
  defaultValues?: AddressParts | null;
  /** Presente = bloco do pet, com a opção de herdar o endereço do tutor. */
  tutorAddress?: AddressParts | null;
  /**
   * Texto do "mesmo endereço do tutor" quando não há endereço a exibir — no
   * cadastro de tutor + primeiro pet o endereço do tutor está sendo digitado
   * ali mesmo, logo acima, e não teria como ser repetido aqui.
   */
  inheritNote?: string;
  title?: string;
}) {
  const inherits = tutorAddress !== undefined;
  const [sameAsTutor, setSameAsTutor] = useState(
    () => inherits && !hasAddress(defaultValues),
  );

  // Controlados porque o CEP os preenche; o estado sobrevive a marcar e
  // desmarcar "mesmo endereço do tutor" (quem desmonta são os inputs).
  const [cep, setCep] = useState(() => formatCep(defaultValues?.cep ?? ""));
  const [street, setStreet] = useState(defaultValues?.street ?? "");
  const [district, setDistrict] = useState(defaultValues?.district ?? "");
  const [city, setCity] = useState(defaultValues?.city ?? "");
  const [state, setState] = useState(defaultValues?.state ?? "");
  const numberRef = useRef<HTMLInputElement>(null);

  const field = (name: string) => `${prefix}${name}`;
  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const tutorLine = formatAddressLine(tutorAddress);

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-graphite">{title}</p>

      {inherits && (
        <div className="rounded-xl border border-graphite/10 bg-surface-muted/40 p-3">
          <Checkbox
            label="Mesmo endereço do tutor"
            checked={sameAsTutor}
            onChange={(event) => setSameAsTutor(event.target.checked)}
          />
          {sameAsTutor && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-gray-neutral">
              <PinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {tutorLine ?? inheritNote ?? "O tutor ainda não tem endereço cadastrado."}
            </p>
          )}
        </div>
      )}

      {!sameAsTutor && (
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("cep")}>CEP</Label>
            <CepInput
              id={fieldId("cep")}
              name={field("cep")}
              value={cep}
              onChange={setCep}
              onResolved={(address) => {
                // O ViaCEP devolve rua e bairro vazios nos CEPs de cidade
                // inteira; nesse caso o que já estava digitado vale mais.
                if (address.street) setStreet(address.street);
                if (address.district) setDistrict(address.district);
                setCity(address.city);
                setState(address.state);
                numberRef.current?.focus();
              }}
            />
          </div>
          <div className="sm:col-span-4">
            <Label htmlFor={fieldId("street")}>Rua</Label>
            <Input
              id={fieldId("street")}
              name={field("street")}
              value={street}
              onChange={(event) => setStreet(event.target.value)}
              placeholder="Ex.: Av. Atlântica"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("street_number")}>Número</Label>
            <Input
              ref={numberRef}
              id={fieldId("street_number")}
              name={field("street_number")}
              defaultValue={defaultValues?.street_number ?? ""}
              placeholder="Ex.: 1702 ou s/n"
            />
          </div>
          <div className="sm:col-span-4">
            <Label htmlFor={fieldId("complement")}>Complemento</Label>
            <Input
              id={fieldId("complement")}
              name={field("complement")}
              defaultValue={defaultValues?.complement ?? ""}
              placeholder="Ex.: apto 501, bloco B"
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("district")}>Bairro</Label>
            <Input
              id={fieldId("district")}
              name={field("district")}
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("city")}>Cidade</Label>
            <Input
              id={fieldId("city")}
              name={field("city")}
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor={fieldId("state")}>UF</Label>
            <Select
              id={fieldId("state")}
              name={field("state")}
              value={state}
              onChange={(event) => setState(event.target.value)}
            >
              <option value="">—</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
