"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarX2, MessageCircle, PawPrint } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  ChoiceChips,
  Label,
  Select,
  DatePicker,
  Textarea,
  ServicePicker,
  cn,
  type ServiceOption,
} from "@mylivepet/ui";
import {
  formatBRL,
  hasAddress,
  hasSizePrices,
  petSizeLabel,
  priceForPetSize,
  weekdayOfDateString,
  worksOnWeekday,
  type SizePrices,
} from "@mylivepet/types";
import { joinServices, relativeDay, shortDay, timeOf } from "@/lib/home";
import { requestBooking } from "../actions";
import { SlotPicker, type Collaborator } from "./slot-picker";

type Pet = {
  id: string;
  name: string;
  size: string | null;
  photo_path: string | null;
  /** Endereço próprio do pet; vazio = ele mora com o tutor (0059). */
  cep: string | null;
  street: string | null;
  city: string | null;
};

/** As colunas de endereço do tutor que interessam para o leva e traz. */
type TutorAddress = { cep: string | null; street: string | null; city: string | null };

/** Serviço do catálogo com os preços por porte ainda por resolver (0058). */
type BookingService = ServiceOption & SizePrices;

/** Quantos dias aparecem como atalho antes do calendário. */
const QUICK_DAYS = 10;

/** Data local em YYYY-MM-DD, `offset` dias a partir de hoje. */
function localISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "Qui 22" a partir de YYYY-MM-DD (meio-dia local, para não virar o dia). */
function chipLabel(iso: string, offset: number): string {
  if (offset === 0) return "Hoje";
  if (offset === 1) return "Amanhã";
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()}`;
}

const sectionTitle = "font-heading text-base font-semibold text-graphite";

export function BookingForm({
  pets,
  services,
  addons,
  collaborators,
  tutorAddress,
  tenantId,
  whatsappHref,
}: {
  pets: Pet[];
  services: BookingService[];
  /** Extras do catálogo, somados ao valor do agendamento (0056). */
  addons: BookingService[];
  collaborators: Collaborator[];
  /** Endereço do tutor — null quando ele ainda não completou o cadastro. */
  tutorAddress: TutorAddress | null;
  tenantId: string;
  /** Link do WhatsApp do petshop, quando ele tem telefone cadastrado. */
  whatsappHref: string | null;
}) {
  // Se só houver um serviço cadastrado, já vem marcado (atende "caso mais de um serviço").
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(services.length === 1 ? [services[0].id] : []),
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [petId, setPetId] = useState(() => pets[0]?.id ?? "");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(""); // ISO do horário escolhido
  const [pickup, setPickup] = useState(false);
  const [dropoff, setDropoff] = useState(false);

  // Quanto custa para ESTE pet: o preço sai do porte dele (0058), sem ninguém
  // precisar escolher. Pet sem porte cadastrado fica no preço base.
  const petEscolhido = pets.find((p) => p.id === petId) ?? null;
  const petSize = petEscolhido?.size ?? null;

  // Dá para pedir que busquem em casa? Só com endereço cadastrado — e a regra
  // de qual endereço vale é a da 0059: o do pet quando ele tem o seu, senão o
  // do tutor. Sem nenhum dos dois, o campo aparece desabilitado com o caminho
  // para resolver, em vez de simplesmente sumir: campo escondido não ensina
  // nada a quem está procurando por ele.
  const temEndereco = hasAddress(petEscolhido) || hasAddress(tutorAddress);
  const pricedServices = useMemo<ServiceOption[]>(
    () => services.map((s) => ({ ...s, price_cents: priceForPetSize(s, petSize) })),
    [services, petSize],
  );
  const pricedAddons = useMemo<ServiceOption[]>(
    () => addons.map((a) => ({ ...a, price_cents: priceForPetSize(a, petSize) })),
    [addons, petSize],
  );

  // Atalhos de data: os próximos dias, riscados quando ninguém tem expediente.
  const quickDays = useMemo(
    () =>
      Array.from({ length: QUICK_DAYS }, (_, offset) => {
        const iso = localISO(offset);
        const weekday = weekdayOfDateString(iso);
        return {
          value: iso,
          label: chipLabel(iso, offset),
          disabled: !collaborators.some((c) =>
            worksOnWeekday(c.collaborator_schedule, weekday),
          ),
        };
      }),
    [collaborators],
  );

  // A data manda: só entra na lista quem tem expediente naquele dia da semana.
  const available = useMemo(() => {
    if (!date) return [];
    const weekday = weekdayOfDateString(date);
    return collaborators.filter((c) =>
      worksOnWeekday(c.collaborator_schedule, weekday),
    );
  }, [collaborators, date]);

  // Trocar a data pode invalidar quem já estava escolhido; com um único
  // profissional disponível, já deixa marcado.
  useEffect(() => {
    setCollaboratorId((current) => {
      if (available.some((c) => c.id === current)) return current;
      return available.length === 1 ? available[0].id : "";
    });
  }, [available]);

  // Sem endereço não há leva e traz: desmarca o que tinha sido marcado com
  // outro pet.
  useEffect(() => {
    if (!temEndereco) {
      setPickup(false);
      setDropoff(false);
    }
  }, [temEndereco]);

  const collaborator = available.find((c) => c.id === collaboratorId);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosenServices = pricedServices.filter((s) => selected.has(s.id));
  const chosenAddons = pricedAddons.filter((a) => selectedAddons.has(a.id));
  // Serviços + adicionais: é o valor que o tutor vai pagar no petshop.
  const totalCents =
    chosenServices.reduce((sum, s) => sum + s.price_cents, 0) +
    chosenAddons.reduce((sum, a) => sum + a.price_cents, 0);
  const totalMinutes = chosenServices.reduce((sum, s) => sum + (s.duration_min ?? 0), 0);

  // Sem porte o preço cai no base, o que num pet grande sai abaixo do que o
  // petshop cobra (0058). Só trava quando o item escolhido tem preço por porte
  // — serviço de preço único continua podendo ser solicitado.
  const needsPetSize =
    !petSize &&
    (services.some((s) => selected.has(s.id) && hasSizePrices(s)) ||
      addons.some((a) => selectedAddons.has(a.id) && hasSizePrices(a)));

  const noTeam = collaborators.length === 0;

  // O que ainda falta, na ordem do formulário — vira o texto sob o botão.
  const missing = [
    selected.size === 0 && "o serviço",
    needsPetSize && "o porte do pet",
    !date && "a data",
    date && !collaboratorId && "o profissional",
    date && collaboratorId && !slot && "o horário",
  ].filter(Boolean) as string[];

  const canSubmit = !noTeam && missing.length === 0;

  if (pets.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-petrol/[0.07] text-petrol">
          <PawPrint className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading font-semibold text-graphite">Cadastre seu pet primeiro</p>
          <p className="mt-0.5 text-sm text-gray-neutral">
            O agendamento é sempre para um pet — o porte dele define o preço do serviço.
          </p>
        </div>
        <Link
          href="/meus-pets"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-orange px-5 text-sm font-semibold text-white transition-colors hover:bg-orange/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2"
        >
          Ir para Meus pets
        </Link>
      </Card>
    );
  }

  return (
    <form
      action={requestBooking}
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <Card className="divide-y divide-graphite/5 p-0">
        <section className="p-5">
          <h2 className={sectionTitle}>Para quem</h2>
          <input type="hidden" name="pet_id" value={petId} />
          {pets.length === 1 ? (
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={pets[0]!.name} src={pets[0]!.photo_path} size="md" />
              <div className="min-w-0">
                <p className="truncate font-medium text-graphite">{pets[0]!.name}</p>
                <p className="text-xs text-gray-neutral">
                  {petSize ? `Porte ${petSizeLabel(petSize)?.toLowerCase()}` : "Porte não informado"}
                </p>
              </div>
            </div>
          ) : (
            <ChoiceChips
              aria-label="Pet"
              allowEmpty={false}
              className="mt-3"
              value={petId}
              onChange={(v) => v && setPetId(v)}
              options={pets.map((p) => ({
                value: p.id,
                // A foto ajuda a reconhecer; as iniciais, sobre o laranja do
                // selecionado, só poluem — sem foto, fica o nome.
                label: p.photo_path ? (
                  <span className="flex items-center gap-1.5">
                    <Avatar name={p.name} src={p.photo_path} size="sm" className="h-5 w-5" />
                    {p.name}
                  </span>
                ) : (
                  p.name
                ),
              }))}
            />
          )}
        </section>

        <section className="space-y-4 p-5">
          <div>
            <Label>
              Serviços{" "}
              {services.length > 1 && (
                <span className="font-normal text-gray-neutral">(escolha um ou mais)</span>
              )}
            </Label>
            <ServicePicker
              services={pricedServices}
              selected={selected}
              toggle={toggle}
            />
            {/* De onde saiu o preço: com porte, é o dele; sem porte, o base. */}
            {services.length > 0 && petSize && (
              <p className="mt-1.5 text-xs text-gray-neutral">
                Preços do porte {petSizeLabel(petSize)?.toLowerCase()}.
              </p>
            )}
          </div>

          {/* O preço destes serviços depende do porte e a ficha do pet não tem um.
              Aqui o tutor completa a ficha em Meus pets — é o cadastro dele. */}
          {needsPetSize && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-semibold text-graphite">
                Falta o porte do pet
              </p>
              <p className="mt-0.5 text-xs text-gray-neutral">
                O preço destes serviços muda conforme o porte. Complete a ficha do
                pet para continuar.
              </p>
              <Link
                href={`/pets/${petId}`}
                className="mt-2 inline-block text-sm font-medium text-brand underline"
              >
                Informar o porte
              </Link>
            </div>
          )}

          {/* Extras do pedido inteiro, escolhidos depois do serviço principal
              (ver 0056_service_addon.sql). */}
          {addons.length > 0 && (
            <div>
              <Label>
                Serviços adicionais{" "}
                <span className="font-normal text-gray-neutral">(opcional)</span>
              </Label>
              {selected.size === 0 ? (
                <p className="text-sm text-gray-neutral">Escolha o serviço antes.</p>
              ) : (
                <ServicePicker
                  services={pricedAddons}
                  selected={selectedAddons}
                  toggle={toggleAddon}
                  name="service_addon_id"
                  labels={{
                    placeholder: "Nenhum adicional",
                    hint: null,
                    noun: "adicional",
                    nounPlural: "adicionais",
                    searchPlaceholder: "Buscar adicional...",
                    empty: "Nenhum adicional encontrado.",
                  }}
                />
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 p-5">
          <h2 className={sectionTitle}>Quando</h2>

          {noTeam ? (
            // Sem equipe cadastrada não há grade de horários: em vez de pedir
            // data e horário que nunca vão aparecer, o tutor sai daqui sabendo
            // o que fazer.
            <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-muted p-4 sm:flex-row sm:items-center">
              <CalendarX2 className="h-5 w-5 shrink-0 text-gray-neutral" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-graphite">
                  A agenda pelo app ainda não está aberta
                </p>
                <p className="mt-0.5 text-xs text-gray-neutral">
                  O petshop ainda não cadastrou os profissionais. Enquanto isso, marque direto com ele.
                </p>
              </div>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-graphite/10 bg-surface px-4 text-sm font-medium text-graphite transition-colors hover:bg-gray-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-graphite focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-4 w-4 text-success" aria-hidden /> Falar com o petshop
                </a>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="scheduled_date">Data</Label>
                <ChoiceChips
                  aria-label="Próximos dias"
                  allowEmpty={false}
                  value={date}
                  onChange={(v) => {
                    if (!v) return;
                    setDate(v);
                    setSlot("");
                  }}
                  options={quickDays}
                />
                <p className="mb-1.5 mt-3 text-xs text-gray-neutral">Ou escolha outra data:</p>
                <DatePicker
                  id="scheduled_date"
                  mode="date"
                  min={localISO()}
                  value={date}
                  onChange={(v) => {
                    setDate(v);
                    setSlot("");
                  }}
                />
              </div>

              <div>
                <Label htmlFor="collaborator_id">Profissional</Label>
                {date && available.length === 0 ? (
                  <p className="text-sm text-gray-neutral">
                    Nenhum profissional atende nesta data. Escolha outro dia.
                  </p>
                ) : (
                  <Select
                    id="collaborator_id"
                    name="collaborator_id"
                    required
                    disabled={!date}
                    value={collaboratorId}
                    onChange={(e) => {
                      setCollaboratorId(e.target.value);
                      setSlot("");
                    }}
                  >
                    <option value="" disabled>
                      {date ? "Escolha o profissional" : "Escolha a data antes"}
                    </option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.role_title ? `${c.full_name} · ${c.role_title}` : c.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div>
                <Label>Horário</Label>
                {/* Instante escolhido na grade; validado/enviado pela server action. */}
                <input type="hidden" name="scheduled_at" value={slot} />
                <SlotPicker
                  tenantId={tenantId}
                  collaborator={collaborator}
                  date={date}
                  value={slot}
                  onChange={setSlot}
                />
              </div>
            </>
          )}
        </section>

        {/* Sem agenda aberta não há pedido a enviar: leva e traz e observações
            só ocupariam espaço. */}
        {!noTeam && (
          <>
            <section className="p-5">
              <h2 className={sectionTitle}>
                Leva e traz <span className="font-sans text-sm font-normal text-gray-neutral">(opcional)</span>
              </h2>
              <p className="mt-0.5 text-xs text-gray-neutral">
                O petshop confirma junto com o horário.
              </p>
              <div className="mt-3 grid gap-3">
                <Checkbox
                  name="pickup"
                  label="Quero que busquem meu pet em casa"
                  disabled={!temEndereco}
                  checked={pickup}
                  onChange={(e) => setPickup(e.target.checked)}
                />
                <Checkbox
                  name="dropoff"
                  label="Quero que tragam meu pet de volta"
                  disabled={!temEndereco}
                  checked={dropoff}
                  onChange={(e) => setDropoff(e.target.checked)}
                />
              </div>
              {!temEndereco && (
                <p className="mt-2 text-xs text-gray-neutral">
                  Para pedir, cadastre seu endereço em{" "}
                  <Link href="/configuracoes" className="font-medium text-orange underline">
                    Configurações
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="p-5">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                placeholder="Ex.: meu pet fica ansioso com secador."
              />
            </section>
          </>
        )}
      </Card>

      {/* Resumo: acompanha o tutor enquanto ele preenche (fixo no desktop) e
          é onde o pedido sai. */}
      <Card className="space-y-4 lg:sticky lg:top-8">
        <h2 className={sectionTitle}>Resumo do pedido</h2>

        {petEscolhido && (
          <div className="flex items-center gap-2.5">
            <Avatar name={petEscolhido.name} src={petEscolhido.photo_path} size="sm" />
            <p className="truncate text-sm font-medium text-graphite">{petEscolhido.name}</p>
          </div>
        )}

        {chosenServices.length === 0 ? (
          <p className="text-sm text-gray-neutral">Nenhum serviço escolhido ainda.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {[...chosenServices, ...chosenAddons].map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-graphite">{item.name}</span>
                <span className="shrink-0 tabular-nums text-gray-neutral">
                  {formatBRL(item.price_cents)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5 border-t border-graphite/5 pt-4 text-sm">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-gray-neutral">Quando</span>
            <span className="text-right font-medium text-graphite">
              {slot
                ? `${relativeDay(slot)}, ${shortDay(slot)} às ${timeOf(slot)}`
                : date
                  ? `${chipLabel(date, -1)} · falta o horário`
                  : "—"}
            </span>
          </p>
          {collaborator && (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-gray-neutral">Com</span>
              <span className="truncate font-medium text-graphite">{collaborator.full_name}</span>
            </p>
          )}
          {totalMinutes > 0 && (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-gray-neutral">Duração</span>
              <span className="font-medium tabular-nums text-graphite">
                {totalMinutes >= 60
                  ? `${Math.floor(totalMinutes / 60)}h${totalMinutes % 60 ? String(totalMinutes % 60).padStart(2, "0") : ""}`
                  : `${totalMinutes}min`}
              </span>
            </p>
          )}
          {(pickup || dropoff) && (
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-gray-neutral">Leva e traz</span>
              <span className="font-medium text-graphite">
                {pickup && dropoff ? "Buscar e devolver" : pickup ? "Buscar em casa" : "Devolver em casa"}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-graphite/5 pt-4">
          <span className="text-sm text-gray-neutral">Total</span>
          <span className="font-heading text-2xl font-bold tabular-nums text-graphite">
            {formatBRL(totalCents)}
          </span>
        </div>

        <div className="space-y-2">
          <Button type="submit" className="w-full" disabled={!canSubmit}>
            Enviar solicitação
          </Button>
          <p className={cn("text-center text-xs", canSubmit ? "text-gray-neutral" : "text-graphite/70")}>
            {noTeam
              ? "A agenda pelo app ainda não está aberta."
              : missing.length > 0
                ? `Falta escolher ${joinServices(missing)}.`
                : "O petshop confirma o horário e você recebe um aviso."}
          </p>
        </div>
      </Card>
    </form>
  );
}
