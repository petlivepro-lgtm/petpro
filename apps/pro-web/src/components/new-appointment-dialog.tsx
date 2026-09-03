"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Plus, Stethoscope } from "lucide-react";
import {
  ActionTile,
  Button,
  Checkbox,
  DatePicker,
  Dialog,
  Label,
  Select,
  ServicePicker,
  Textarea,
  type ServiceOption,
} from "@mylivepet/ui";
import {
  formatBRL,
  hasSizePrices,
  petSizeLabel,
  priceForPetSize,
  PET_SIZES,
  PET_SIZE_LABEL,
  weekdayOfDateString,
  worksOnWeekday,
} from "@mylivepet/types";
import {
  createStaffBooking,
  setPetSize,
  type FormState,
} from "@/app/(app)/actions";
import { NewTutorDialog } from "@/components/new-tutor-dialog";
import { SlotPicker } from "@/components/slot-picker";
import { useOpenFromUrl } from "@/lib/use-open-from-url";
import type {
  BookingCollaborator,
  BookingService,
  BookingTutor,
} from "@/lib/booking-options";

/** Data local de hoje em YYYY-MM-DD (limite mínimo do calendário). */
function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * O petshop agenda em nome do tutor. Mesmos campos que o tutor tem no app
 * (pet, serviços, profissional, data e horário), com duas diferenças de balcão:
 * o agendamento já nasce confirmado e o atendente pode encaixar fora da grade
 * do profissional.
 */
export function NewAppointmentDialog({
  tenantId,
  services,
  addons,
  collaborators,
  tutors = [],
  fixedPet,
  trigger = "button",
  open: controlledOpen,
  onOpenChange,
  defaultSlot,
  defaultCollaboratorId,
}: {
  tenantId: string;
  services: BookingService[];
  /** Extras do catálogo, somados ao valor do agendamento (0056). */
  addons: BookingService[];
  collaborators: BookingCollaborator[];
  /** Necessário quando não há pet fixo (o cliente é escolhido no diálogo). */
  tutors?: BookingTutor[];
  /** Ficha do pet: cliente e pet já definidos. O porte define o preço (0058). */
  fixedPet?: { id: string; name: string; size: string | null };
  /** "none" para quem já tem o próprio gatilho e controla `open`. */
  trigger?: "button" | "tile" | "none";
  /** Abre o diálogo de fora (célula vazia da agenda). Sem isso, é interno. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** "YYYY-MM-DDTHH:mm" do horário clicado na agenda. */
  defaultSlot?: string;
  /** Profissional da coluna clicada na visão de Dia da agenda. */
  defaultCollaboratorId?: string;
}) {
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  // "Novo agendamento" na paleta chega como ?novo=agendamento. As instâncias
  // controladas de fora (a célula clicada na grade) já têm quem as abra.
  useOpenFromUrl(
    "agendamento",
    () => setUncontrolledOpen(true),
    trigger !== "none",
  );

  const [tutorId, setTutorId] = useState("");
  const [petId, setPetId] = useState(fixedPet?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [collaboratorId, setCollaboratorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(""); // ISO vindo da grade
  const [freeTime, setFreeTime] = useState(false);
  const [freeSlot, setFreeSlot] = useState(""); // "YYYY-MM-DDTHH:mm" do encaixe

  // Cadastro rápido do cliente novo, sem sair do agendamento em andamento.
  const [quickTutorOpen, setQuickTutorOpen] = useState(false);
  const [newTutors, setNewTutors] = useState<BookingTutor[]>([]);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStaffBooking,
    { ok: false },
  );

  // Grava só o porte do pet, sem sair daqui. Chamada direto (não por um
  // <form action>): já estamos dentro do formulário do agendamento, e form
  // dentro de form quebra o submit.
  const [sizeDraft, setSizeDraft] = useState("");
  const [sizeState, saveSize, savingSize] = useActionState<FormState, FormData>(
    setPetSize,
    { ok: false },
  );

  // O tutor recém-cadastrado entra na lista na hora, sem esperar o
  // `router.refresh()`; quando o servidor responde, a cópia local some.
  const tutorOptions = useMemo(() => {
    if (newTutors.length === 0) return tutors;
    const known = new Set(tutors.map((t) => t.id));
    const extras = newTutors.filter((t) => !known.has(t.id));
    if (extras.length === 0) return tutors;
    return [...tutors, ...extras].sort((a, b) =>
      a.full_name.localeCompare(b.full_name, "pt-BR"),
    );
  }, [tutors, newTutors]);

  const tutor = tutorOptions.find((t) => t.id === tutorId);
  const pets = fixedPet ? [] : (tutor?.pet ?? []);

  // O porte do pet é quem escolhe o preço do serviço (0058). Ninguém seleciona
  // porte no agendamento: ele vem da ficha do pet. Quando falta, o bloco mais
  // abaixo pede e grava na hora — o porte recém-salvo fica aqui até o
  // router.refresh() trazer a ficha atualizada do servidor.
  const [savedSizes, setSavedSizes] = useState<Record<string, string>>({});
  const currentPetId = fixedPet?.id ?? petId;
  const petSize =
    savedSizes[currentPetId] ??
    (fixedPet ? fixedPet.size : (pets.find((p) => p.id === petId)?.size ?? null));

  const pricedServices = useMemo<ServiceOption[]>(
    () => services.map((s) => ({ ...s, price_cents: priceForPetSize(s, petSize) })),
    [services, petSize],
  );
  const pricedAddons = useMemo<ServiceOption[]>(
    () => addons.map((a) => ({ ...a, price_cents: priceForPetSize(a, petSize) })),
    [addons, petSize],
  );

  // A data manda: só entra na lista quem tem expediente naquele dia da semana.
  // No encaixe não há grade a respeitar, então todos continuam disponíveis.
  const available = useMemo(() => {
    if (freeTime) return collaborators;
    if (!date) return [];
    const weekday = weekdayOfDateString(date);
    return collaborators.filter((c) =>
      worksOnWeekday(c.collaborator_schedule, weekday),
    );
  }, [collaborators, date, freeTime]);

  const collaborator = available.find((c) => c.id === collaboratorId);

  // Trocar a data pode invalidar quem já estava escolhido. Declarado antes do
  // efeito de `defaultSlot` para não desfazer o profissional que ele preenche.
  useEffect(() => {
    setCollaboratorId((current) =>
      available.some((c) => c.id === current) ? current : "",
    );
  }, [available]);

  // O encaixe vem como horário local; o banco guarda timestamptz.
  const scheduledAt = useMemo(() => {
    if (!freeTime) return slot;
    if (!freeSlot) return "";
    const parsed = new Date(freeSlot);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [freeTime, slot, freeSlot]);

  // Sem porte, o preço cai no base. Isso só é problema quando o item escolhido
  // TEM preço por porte: aí o base pode sair mais barato do que o petshop
  // cobra, e o prejuízo passa despercebido. Serviço de preço único segue
  // agendando normalmente, sem porte nenhum.
  const needsPetSize =
    !petSize &&
    (services.some((s) => selected.has(s.id) && hasSizePrices(s)) ||
      addons.some((a) => selectedAddons.has(a.id) && hasSizePrices(a)));

  const canSubmit =
    !!petId &&
    selected.size > 0 &&
    !!collaboratorId &&
    !!scheduledAt &&
    !needsPetSize;

  // Agendou: fecha, limpa o formulário e recarrega a agenda.
  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    setTutorId("");
    setPetId(fixedPet?.id ?? "");
    setSelected(new Set());
    setSelectedAddons(new Set());
    setCollaboratorId("");
    setDate("");
    setSlot("");
    setFreeTime(false);
    setFreeSlot("");
    setSizeDraft("");
    router.refresh();
  }, [state.ok, router, fixedPet?.id]);

  // Clicou numa célula vazia da agenda: o diálogo já abre no dia certo, e o
  // horário exato fica pronto no campo de encaixe — a grade do profissional
  // continua mandando em quem não marcar "encaixe".
  //
  // Na visão de Dia a coluna é o profissional, então clicar nela já responde
  // quem atende; a de Semana não diz nada a respeito e deixa o campo como está.
  useEffect(() => {
    if (!open || !defaultSlot) return;
    setDate(defaultSlot.slice(0, 10));
    setFreeSlot(defaultSlot);
    setSlot("");
    if (defaultCollaboratorId) setCollaboratorId(defaultCollaboratorId);
  }, [open, defaultSlot, defaultCollaboratorId]);

  // Porte salvo: passa a valer aqui na hora, e o refresh alinha a ficha do pet.
  useEffect(() => {
    if (!sizeState.ok || !sizeDraft || !currentPetId) return;
    setSavedSizes((prev) => ({ ...prev, [currentPetId]: sizeDraft }));
    setSizeDraft("");
    router.refresh();
  }, [sizeState, currentPetId, sizeDraft, router]);

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

  // Total do agendamento: serviços + adicionais. Só aparece quando há
  // adicional escolhido — sem eles o próprio seletor de serviços já soma.
  const totalCents =
    pricedServices
      .filter((s) => selected.has(s.id))
      .reduce((sum, s) => sum + s.price_cents, 0) +
    pricedAddons
      .filter((a) => selectedAddons.has(a.id))
      .reduce((sum, a) => sum + a.price_cents, 0);

  return (
    <>
      {trigger === "none" ? null : trigger === "tile" ? (
        <ActionTile
          label="Atendimento"
          icon={<Stethoscope className="h-6 w-6" />}
          color="#2D6CDF"
          className="w-full"
          onClick={() => setOpen(true)}
        />
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" /> Novo agendamento
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          // Escape é ouvido no document pelos dois diálogos: com o cadastro
          // rápido por cima, o fechamento é dele, não do agendamento.
          if (!next && quickTutorOpen) return;
          setOpen(next);
        }}
        title="Novo agendamento"
        description={
          fixedPet
            ? `Agendando para ${fixedPet.name}. Já entra confirmado na agenda.`
            : "Agende em nome do tutor. Já entra confirmado na agenda."
        }
      >
        <form action={formAction} className="space-y-4">
          {fixedPet && (
            <input type="hidden" name="pet_id" value={fixedPet.id} />
          )}

          {!fixedPet && (
            <>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="booking-tutor">Cliente</Label>
                  <button
                    type="button"
                    onClick={() => setQuickTutorOpen(true)}
                    className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-dashed border-graphite/20 px-3 py-1 text-sm text-gray-neutral transition-colors hover:border-orange hover:text-orange"
                  >
                    <Plus className="h-3.5 w-3.5" /> Novo tutor
                  </button>
                </div>
                <Select
                  id="booking-tutor"
                  searchable
                  searchPlaceholder="Buscar por nome ou telefone..."
                  value={tutorId}
                  onChange={(event) => {
                    setTutorId(event.target.value);
                    setPetId("");
                  }}
                  required
                >
                  <option value="" disabled>
                    Selecione o tutor
                  </option>
                  {tutorOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                      {t.phone ? ` · ${t.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="booking-pet">Pet</Label>
                {tutorId && pets.length === 0 ? (
                  <p className="text-sm text-gray-neutral">
                    Este tutor ainda não tem pets cadastrados.
                  </p>
                ) : (
                  <Select
                    id="booking-pet"
                    name="pet_id"
                    searchable
                    searchPlaceholder="Buscar pet..."
                    value={petId}
                    onChange={(event) => setPetId(event.target.value)}
                    disabled={!tutorId}
                    required
                  >
                    <option value="" disabled>
                      {tutorId ? "Selecione o pet" : "Escolha o cliente antes"}
                    </option>
                    {pets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </>
          )}

          <div>
            <Label>
              Serviços{" "}
              {services.length > 1 && (
                <span className="font-normal text-gray-neutral">
                  (escolha um ou mais)
                </span>
              )}
            </Label>
            {services.length === 0 ? (
              <p className="text-sm text-gray-neutral">
                Cadastre um serviço em Serviços para poder agendar.
              </p>
            ) : (
              <ServicePicker
                services={pricedServices}
                selected={selected}
                toggle={toggle}
                searchable
              />
            )}
            {/* De onde saiu o preço: com porte, é o dele; sem porte, o base. */}
            {services.length > 0 && currentPetId && petSize && (
              <p className="mt-1.5 text-xs text-gray-neutral">
                Preços do porte {petSizeLabel(petSize)?.toLowerCase()}.
              </p>
            )}
          </div>

          {/* O preço destes serviços depende do porte e a ficha do pet não tem
              um. Deixar passar cobraria o preço base, que num pet grande sai
              abaixo do que o petshop cobra — então o agendamento para aqui até
              o porte ser preenchido. Preenche na hora para não perder o que já
              foi escolhido. */}
          {needsPetSize && currentPetId && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-semibold text-graphite">
                Falta o porte do pet
              </p>
              <p className="mt-0.5 text-xs text-gray-neutral">
                O preço destes serviços muda conforme o porte. Informe abaixo
                para continuar — fica salvo na ficha do pet.
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1">
                  <Label htmlFor="booking-pet-size">Porte</Label>
                  <Select
                    id="booking-pet-size"
                    value={sizeDraft}
                    onChange={(event) => setSizeDraft(event.target.value)}
                  >
                    <option value="" disabled>
                      Selecione o porte
                    </option>
                    {PET_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {PET_SIZE_LABEL[size]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!sizeDraft || savingSize}
                  onClick={() => {
                    const data = new FormData();
                    data.set("pet_id", currentPetId);
                    data.set("size", sizeDraft);
                    saveSize(data);
                  }}
                >
                  {savingSize ? "Salvando..." : "Salvar porte"}
                </Button>
              </div>
              {sizeState.error && (
                <p className="mt-2 text-sm text-danger">{sizeState.error}</p>
              )}
            </div>
          )}

          {/* Extras do agendamento inteiro: valem para o conjunto, não para um
              serviço específico (ver 0056_service_addon.sql). Sem adicional no
              catálogo, o campo nem aparece. */}
          {addons.length > 0 && (
            <div>
              <Label>
                Serviços adicionais{" "}
                <span className="font-normal text-gray-neutral">
                  (opcional)
                </span>
              </Label>
              {selected.size === 0 ? (
                <p className="text-sm text-gray-neutral">
                  Escolha o serviço antes.
                </p>
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

          {/* A soma das duas listas, para o balcão conferir antes de agendar. */}
          {selectedAddons.size > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-orange/5 px-3 py-2.5 text-sm">
              <span className="text-gray-neutral">Total do agendamento</span>
              <span className="font-heading text-base font-bold text-graphite">
                {formatBRL(totalCents)}
              </span>
            </div>
          )}

          {/* A data vem antes do profissional: é ela que define quem atende. */}
          {freeTime ? (
            <div>
              <Label htmlFor="booking-free-slot">Data e hora do encaixe</Label>
              <DatePicker
                id="booking-free-slot"
                mode="datetime"
                value={freeSlot}
                onChange={setFreeSlot}
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="booking-date">Data</Label>
              <DatePicker
                id="booking-date"
                mode="date"
                min={todayISO()}
                value={date}
                onChange={(v) => {
                  setDate(v);
                  setSlot("");
                }}
              />
            </div>
          )}

          <div>
            <Label htmlFor="booking-collaborator">Profissional</Label>
            {collaborators.length === 0 ? (
              <p className="text-sm text-gray-neutral">
                Cadastre um profissional em Colaboradores para poder agendar.
              </p>
            ) : !freeTime && date && available.length === 0 ? (
              <p className="text-sm text-gray-neutral">
                Nenhum profissional atende nesta data. Escolha outro dia ou
                marque o encaixe abaixo.
              </p>
            ) : (
              <Select
                id="booking-collaborator"
                name="collaborator_id"
                searchable
                searchPlaceholder="Buscar profissional..."
                disabled={!freeTime && !date}
                value={collaboratorId}
                onChange={(event) => {
                  setCollaboratorId(event.target.value);
                  setSlot("");
                }}
                required
              >
                <option value="" disabled>
                  {freeTime || date
                    ? "Selecione o profissional"
                    : "Escolha a data antes"}
                </option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.role_title
                      ? `${c.full_name} · ${c.role_title}`
                      : c.full_name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Instante final: slot da grade ou encaixe convertido para ISO. */}
          <input type="hidden" name="scheduled_at" value={scheduledAt} />
          {/* Encaixe deliberado: a server action só aceita fora da grade assim. */}
          <input
            type="hidden"
            name="off_schedule"
            value={freeTime ? "1" : ""}
          />

          {!freeTime && (
            <div>
              <Label>Horário</Label>
              <SlotPicker
                tenantId={tenantId}
                collaborator={collaborator}
                date={date}
                value={slot}
                onChange={setSlot}
              />
            </div>
          )}

          <Checkbox
            label="Encaixe: horário fora da grade do profissional"
            checked={freeTime}
            onChange={(event) => {
              setFreeTime(event.target.checked);
              setSlot("");
              setFreeSlot("");
            }}
          />

          <div>
            <Label htmlFor="booking-notes">Observações (opcional)</Label>
            <Textarea
              id="booking-notes"
              name="notes"
              rows={3}
              placeholder="Ex.: tutor pediu a tosa mais curta."
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Fora do <form> acima de propósito: o Dialog não usa portal, e <form>
          dentro de <form> quebra o submit. Depois no DOM, também pinta por
          cima — os dois diálogos compartilham o mesmo z-index. */}
      {!fixedPet && (
        <NewTutorDialog
          trigger="none"
          requirePet
          open={quickTutorOpen}
          onOpenChange={setQuickTutorOpen}
          onCreated={(created) => {
            setNewTutors((prev) => [...prev, created]);
            setTutorId(created.id);
            setPetId(created.pet[0]?.id ?? "");
          }}
        />
      )}
    </>
  );
}
