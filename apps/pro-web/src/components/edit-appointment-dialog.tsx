"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import {
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
import { formatBRL, priceForPetSize } from "@mylivepet/types";
import { editAppointment, type FormState } from "@/app/(app)/actions";
import { SlotPicker } from "@/components/slot-picker";
import { dayKey } from "@/lib/atendimentos";
import type {
  BookingCollaborator,
  BookingService,
} from "@/lib/booking-options";

export type EditableAppointment = {
  id: string;
  /** ISO do horário atual. */
  scheduledAt: string;
  collaboratorId: string | null;
  serviceTypeId: string | null;
  notes: string | null;
  /** Leva-e-traz e adicionais vêm da líder do pedido (lib/appointment-group). */
  pickup: boolean;
  dropoff: boolean;
  addonIds: string[];
  petName: string;
  petSize: string | null;
};

/** Serviço irmão do mesmo pedido, no mesmo horário. */
export type EditSibling = { id: string; serviceName: string };

/**
 * Editar um agendamento que ainda não começou, a partir da ficha do
 * atendimento. Os mesmos campos do "Novo agendamento", já preenchidos — menos
 * cliente e pet, que mudar seria outro agendamento.
 *
 * O horário fica como está até alguém pedir para alterar: a grade de horários
 * marcaria o próprio horário atual como ocupado, e quem só queria trocar o
 * adicional não precisa passar por ela.
 */
export function EditAppointmentDialog({
  className,
  ...props
}: {
  tenantId: string;
  appointment: EditableAppointment;
  siblings: EditSibling[];
  services: BookingService[];
  addons: BookingService[];
  collaborators: BookingCollaborator[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={className}
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-4 w-4" /> Editar agendamento
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Editar agendamento"
        description={`${props.appointment.petName}. O profissional e o tutor são avisados se o horário mudar.`}
      >
        {/* Montado só aberto: cada abertura começa do que está salvo. */}
        {open && <EditForm {...props} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function EditForm({
  tenantId,
  appointment,
  siblings,
  services,
  addons,
  collaborators,
  onDone,
}: {
  tenantId: string;
  appointment: EditableAppointment;
  siblings: EditSibling[];
  services: BookingService[];
  addons: BookingService[];
  collaborators: BookingCollaborator[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    editAppointment,
    { ok: false },
  );

  const [serviceId, setServiceId] = useState(
    services.some((s) => s.id === appointment.serviceTypeId)
      ? (appointment.serviceTypeId ?? "")
      : "",
  );
  const [selectedAddons, setSelectedAddons] = useState(
    () => new Set(appointment.addonIds.filter((id) => addons.some((a) => a.id === id))),
  );
  const [collaboratorId, setCollaboratorId] = useState(
    collaborators.some((c) => c.id === appointment.collaboratorId)
      ? (appointment.collaboratorId ?? "")
      : "",
  );
  const [changeTime, setChangeTime] = useState(false);
  const [date, setDate] = useState(() =>
    dayKey(new Date(appointment.scheduledAt)),
  );
  const [slot, setSlot] = useState("");
  const [freeTime, setFreeTime] = useState(false);
  const [freeSlot, setFreeSlot] = useState("");

  useEffect(() => {
    if (!state.ok) return;
    onDone();
    router.refresh();
  }, [state.ok, onDone, router]);

  // Adicional já gravado que saiu do catálogo não aparece no seletor; vai
  // escondido para a action não entender que foi desmarcado.
  const retiredAddons = appointment.addonIds.filter(
    (id) => !addons.some((a) => a.id === id),
  );

  const pricedServices = useMemo(
    () =>
      services.map((s) => ({
        ...s,
        price_cents: priceForPetSize(s, appointment.petSize),
      })),
    [services, appointment.petSize],
  );
  const pricedAddons = useMemo<ServiceOption[]>(
    () =>
      addons.map((a) => ({
        ...a,
        price_cents: priceForPetSize(a, appointment.petSize),
      })),
    [addons, appointment.petSize],
  );

  const collaborator = collaborators.find((c) => c.id === collaboratorId);

  // O instante final: o atual, o slot da grade ou o encaixe convertido.
  const scheduledAt = useMemo(() => {
    if (!changeTime) return appointment.scheduledAt;
    if (!freeTime) return slot;
    if (!freeSlot) return "";
    const parsed = new Date(freeSlot);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
  }, [changeTime, freeTime, slot, freeSlot, appointment.scheduledAt]);

  const toggleAddon = (id: string) =>
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const currentLabel = new Date(appointment.scheduledAt).toLocaleString(
    "pt-BR",
    {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  const canSubmit = !!serviceId && !!collaboratorId && !!scheduledAt;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="appointment_id" value={appointment.id} />
      <input type="hidden" name="scheduled_at" value={scheduledAt} />
      <input type="hidden" name="off_schedule" value={freeTime ? "1" : ""} />
      {retiredAddons.map((id) => (
        <input key={id} type="hidden" name="service_addon_id" value={id} />
      ))}

      <div>
        <Label htmlFor="edit-service">Serviço</Label>
        <Select
          id="edit-service"
          name="service_type_id"
          searchable
          searchPlaceholder="Buscar serviço..."
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          required
        >
          <option value="" disabled>
            Selecione o serviço
          </option>
          {pricedServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {formatBRL(s.price_cents)}
            </option>
          ))}
        </Select>
      </div>

      {addons.length > 0 && (
        <div>
          <Label>
            Serviços adicionais{" "}
            <span className="font-normal text-gray-neutral">(opcional)</span>
          </Label>
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
        </div>
      )}

      <div>
        <Label htmlFor="edit-collaborator">Profissional</Label>
        <Select
          id="edit-collaborator"
          name="collaborator_id"
          searchable
          searchPlaceholder="Buscar profissional..."
          value={collaboratorId}
          onChange={(e) => {
            setCollaboratorId(e.target.value);
            setSlot("");
          }}
          required
        >
          <option value="" disabled>
            Selecione o profissional
          </option>
          {collaborators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.role_title ? `${c.full_name} · ${c.role_title}` : c.full_name}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-xl border border-graphite/10 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-graphite">Data e horário</p>
            <p className="text-xs capitalize text-gray-neutral">
              {changeTime ? `Atual: ${currentLabel}` : currentLabel}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setChangeTime(!changeTime);
              setSlot("");
              setFreeSlot("");
            }}
          >
            {changeTime ? "Manter atual" : "Alterar"}
          </Button>
        </div>

        {changeTime && (
          <div className="mt-3 space-y-3">
            {freeTime ? (
              <div>
                <Label htmlFor="edit-free-slot">Data e hora do encaixe</Label>
                <DatePicker
                  id="edit-free-slot"
                  mode="datetime"
                  value={freeSlot}
                  onChange={setFreeSlot}
                />
              </div>
            ) : (
              <>
                <div>
                  <Label htmlFor="edit-date">Data</Label>
                  <DatePicker
                    id="edit-date"
                    mode="date"
                    min={dayKey(new Date())}
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
          </div>
        )}

        <div className="mt-3">
          <Checkbox
            label="Encaixe: permitir fora da grade do profissional"
            checked={freeTime}
            onChange={(e) => {
              setFreeTime(e.target.checked);
              setSlot("");
              setFreeSlot("");
            }}
          />
        </div>
      </div>

      {siblings.length > 0 && (
        <Checkbox
          name="apply_to_group"
          defaultChecked
          label={`Aplicar horário, profissional e observações também a ${siblings
            .map((s) => s.serviceName)
            .join(" e ")}, do mesmo pedido`}
        />
      )}

      <div className="rounded-xl border border-graphite/10 p-3">
        <p className="mb-2 text-sm font-medium text-graphite">Leva e traz</p>
        <div className="space-y-2">
          <Checkbox
            name="pickup"
            defaultChecked={appointment.pickup}
            label="Buscar o pet em casa"
          />
          <Checkbox
            name="dropoff"
            defaultChecked={appointment.dropoff}
            label="Levar o pet de volta depois"
          />
        </div>
        <p className="mt-2 text-xs text-gray-neutral">
          A rota do entregador se ajusta sozinha.
        </p>
      </div>

      <div>
        <Label htmlFor="edit-notes">Observações (opcional)</Label>
        <Textarea
          id="edit-notes"
          name="notes"
          rows={3}
          defaultValue={appointment.notes ?? ""}
          placeholder="Ex.: tutor pediu a tosa mais curta."
        />
      </div>

      {state.error && <p className="text-sm text-danger">{state.error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
