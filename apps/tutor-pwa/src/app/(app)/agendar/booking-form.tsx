"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatBRL, weekdayOfDateString, worksOnWeekday } from "@mylivepet/types";
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
  addons,
  collaborators,
  tenantId,
}: {
  pets: Pet[];
  services: ServiceOption[];
  /** Extras do catálogo, somados ao valor do agendamento (0056). */
  addons: ServiceOption[];
  collaborators: Collaborator[];
  tenantId: string;
}) {
  // Se só houver um serviço cadastrado, já vem marcado (atende "caso mais de um serviço").
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(services.length === 1 ? [services[0].id] : []),
  );
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [collaboratorId, setCollaboratorId] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState(""); // ISO do horário escolhido

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

  // Serviços + adicionais: é o valor que o tutor vai pagar no petshop.
  const totalCents =
    services.filter((s) => selected.has(s.id)).reduce((sum, s) => sum + s.price_cents, 0) +
    addons.filter((a) => selectedAddons.has(a.id)).reduce((sum, a) => sum + a.price_cents, 0);

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
                services={addons}
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

        {selectedAddons.size > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-orange/5 px-3 py-2.5 text-sm">
            <span className="text-gray-neutral">Total do agendamento</span>
            <span className="font-heading text-base font-bold text-graphite">
              {formatBRL(totalCents)}
            </span>
          </div>
        )}

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
          <Label htmlFor="collaborator_id">Profissional</Label>
          {collaborators.length === 0 ? (
            <p className="text-sm text-gray-neutral">
              O petshop ainda não cadastrou profissionais para agendamento.
            </p>
          ) : date && available.length === 0 ? (
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
