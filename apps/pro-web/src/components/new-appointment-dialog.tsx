"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Stethoscope } from "lucide-react";
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
import { createStaffBooking, type FormState } from "@/app/(app)/actions";
import { SlotPicker } from "@/components/slot-picker";
import type { BookingCollaborator, BookingTutor } from "@/lib/booking-options";

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
  collaborators,
  tutors = [],
  fixedPet,
  trigger = "button",
}: {
  tenantId: string;
  services: ServiceOption[];
  collaborators: BookingCollaborator[];
  /** Necessário quando não há pet fixo (o cliente é escolhido no diálogo). */
  tutors?: BookingTutor[];
  /** Ficha do pet: cliente e pet já definidos. */
  fixedPet?: { id: string; name: string };
  trigger?: "button" | "tile";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [tutorId, setTutorId] = useState("");
  const [petId, setPetId] = useState(fixedPet?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collaboratorId, setCollaboratorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(""); // ISO vindo da grade
  const [freeTime, setFreeTime] = useState(false);
  const [freeSlot, setFreeSlot] = useState(""); // "YYYY-MM-DDTHH:mm" do encaixe

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createStaffBooking,
    { ok: false },
  );

  const tutor = tutors.find((t) => t.id === tutorId);
  const pets = fixedPet ? [] : (tutor?.pet ?? []);
  const collaborator = collaborators.find((c) => c.id === collaboratorId);

  // O encaixe vem como horário local; o banco guarda timestamptz.
  const scheduledAt = useMemo(() => {
    if (!freeTime) return slot;
    if (!freeSlot) return "";
    const parsed = new Date(freeSlot);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [freeTime, slot, freeSlot]);

  const canSubmit =
    !!petId && selected.size > 0 && !!collaboratorId && !!scheduledAt;

  // Agendou: fecha, limpa o formulário e recarrega a agenda.
  useEffect(() => {
    if (!state.ok) return;
    setOpen(false);
    setTutorId("");
    setPetId(fixedPet?.id ?? "");
    setSelected(new Set());
    setCollaboratorId("");
    setDate("");
    setSlot("");
    setFreeTime(false);
    setFreeSlot("");
    router.refresh();
  }, [state.ok, router, fixedPet?.id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      {trigger === "tile" ? (
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
        onOpenChange={setOpen}
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
                <Label htmlFor="booking-tutor">Cliente</Label>
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
                  {tutors.map((t) => (
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
                services={services}
                selected={selected}
                toggle={toggle}
                searchable
              />
            )}
          </div>

          <div>
            <Label htmlFor="booking-collaborator">Profissional</Label>
            {collaborators.length === 0 ? (
              <p className="text-sm text-gray-neutral">
                Cadastre um profissional em Colaboradores para poder agendar.
              </p>
            ) : (
              <Select
                id="booking-collaborator"
                name="collaborator_id"
                searchable
                searchPlaceholder="Buscar profissional..."
                value={collaboratorId}
                onChange={(event) => {
                  setCollaboratorId(event.target.value);
                  setSlot("");
                }}
                required
              >
                <option value="" disabled>
                  Selecione o profissional
                </option>
                {collaborators.map((c) => (
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
            <>
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
            </>
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
    </>
  );
}
