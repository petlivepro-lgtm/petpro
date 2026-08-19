"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Label,
  Select,
  DatePicker,
  Textarea,
  ServicePicker,
  type ServiceOption,
} from "@mylivepet/ui";
import { requestBooking } from "../actions";
import { SlotPicker, type Collaborator } from "./slot-picker";

type Pet = { id: string; name: string };

/** Data local de hoje em YYYY-MM-DD (limite mínimo do calendário). */
function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function BookingForm({
  pets,
  services,
  collaborators,
  tenantId,
}: {
  pets: Pet[];
  services: ServiceOption[];
  collaborators: Collaborator[];
  tenantId: string;
}) {
  // Se só houver um serviço cadastrado, já vem marcado (atende "caso mais de um serviço").
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(services.length === 1 ? [services[0].id] : []),
  );
  const [collaboratorId, setCollaboratorId] = useState(
    () => (collaborators.length === 1 ? collaborators[0].id : ""),
  );
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(""); // ISO do horário escolhido

  const collaborator = collaborators.find((c) => c.id === collaboratorId);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canSubmit = selected.size > 0 && !!collaboratorId && !!slot;

  return (
    <Card>
      <form action={requestBooking} className="space-y-4">
        <div>
          <Label htmlFor="pet_id">Pet</Label>
          <Select id="pet_id" name="pet_id" required>
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>
            Serviços{" "}
            {services.length > 1 && (
              <span className="font-normal text-gray-neutral">(escolha um ou mais)</span>
            )}
          </Label>
          <ServicePicker services={services} selected={selected} toggle={toggle} />
        </div>

        <div>
          <Label htmlFor="collaborator_id">Profissional</Label>
          {collaborators.length === 0 ? (
            <p className="text-sm text-gray-neutral">
              O petshop ainda não cadastrou profissionais para agendamento.
            </p>
          ) : (
            <Select
              id="collaborator_id"
              name="collaborator_id"
              required
              value={collaboratorId}
              onChange={(e) => {
                setCollaboratorId(e.target.value);
                setSlot("");
              }}
            >
              <option value="" disabled>
                Escolha o profissional
              </option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.role_title ? `${c.full_name} · ${c.role_title}` : c.full_name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <Label htmlFor="scheduled_date">Data desejada</Label>
          <DatePicker
            id="scheduled_date"
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

        <div>
          <Label htmlFor="notes">Observações (opcional)</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Ex.: meu pet fica ansioso com secador."
          />
        </div>

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          Enviar solicitação
        </Button>
        <p className="text-center text-xs text-gray-neutral">
          Transparência para você. Processo para o petshop.
        </p>
      </form>
    </Card>
  );
}
