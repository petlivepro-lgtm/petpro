"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock, ChevronDown, X } from "lucide-react";
import { Button, Card, Label, Select, DatePicker, Textarea } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { requestBooking } from "../actions";

type Pet = { id: string; name: string };
type Service = { id: string; name: string; price_cents: number; duration_min: number };

export function BookingForm({ pets, services }: { pets: Pet[]; services: Service[] }) {
  // Se só houver um serviço cadastrado, já vem marcado (atende "caso mais de um serviço").
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(services.length === 1 ? [services[0].id] : []),
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = services.filter((s) => selected.has(s.id));
  const hasSelection = chosen.length > 0;

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
          <ServicePicker services={services} selected={selected} chosen={chosen} toggle={toggle} />
        </div>

        <div>
          <Label htmlFor="scheduled_at">Data e horário desejados</Label>
          <DatePicker id="scheduled_at" name="scheduled_at" mode="datetime" required />
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

        <Button type="submit" className="w-full" disabled={!hasSelection}>
          Enviar solicitação
        </Button>
        <p className="text-center text-xs text-gray-neutral">
          Transparência para você. Processo para o petshop.
        </p>
      </form>
    </Card>
  );
}

/** Seletor de múltiplos serviços: fechado por padrão, abre uma lista em popover. */
function ServicePicker({
  services,
  selected,
  chosen,
  toggle,
}: {
  services: Service[];
  selected: Set<string>;
  chosen: Service[];
  toggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou pressionar Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const totalCents = chosen.reduce((sum, s) => sum + s.price_cents, 0);
  const totalMin = chosen.reduce((sum, s) => sum + s.duration_min, 0);
  const count = chosen.length;

  const summary =
    count === 0
      ? "Selecione um ou mais serviços"
      : count === 1
        ? chosen[0].name
        : `${count} serviços selecionados`;

  return (
    <div className="relative" ref={ref}>
      {/* IDs selecionados enviados ao server action (lidos com formData.getAll). */}
      {chosen.map((s) => (
        <input key={s.id} type="hidden" name="service_type_id" value={s.id} />
      ))}

      {/* Botão fechado, com o mesmo visual do Select. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface pl-3 pr-3 text-sm transition-colors " +
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange " +
          (open ? "border-orange ring-2 ring-orange/40" : "border-graphite/15")
        }
      >
        <span className={"truncate " + (count === 0 ? "text-gray-neutral/80" : "text-graphite")}>
          {summary}
        </span>
        <ChevronDown
          className={"h-4 w-4 shrink-0 text-gray-neutral transition-transform " + (open ? "rotate-180" : "")}
        />
      </button>

      {/* Lista em popover — não polui a página quando há muitos serviços. */}
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-graphite/15 bg-surface p-1.5 shadow-lg">
          <ul className="space-y-1">
            {services.map((s) => {
              const isOn = selected.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={isOn}
                    onClick={() => toggle(s.id)}
                    className={
                      "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors " +
                      (isOn
                        ? "border-orange bg-orange/5"
                        : "border-transparent hover:bg-surface-muted")
                    }
                  >
                    <span
                      className={
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors " +
                        (isOn ? "border-orange bg-orange text-white" : "border-graphite/25 bg-surface")
                      }
                    >
                      {isOn && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-graphite">{s.name}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-neutral">
                        <Clock className="h-3 w-3" /> {s.duration_min}min
                      </span>
                    </span>
                    <span className="shrink-0 font-heading text-sm font-semibold text-graphite">
                      {formatBRL(s.price_cents)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Resumo da seleção sempre visível (mesmo fechado): chips + total. */}
      {count > 0 ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {chosen.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1 rounded-full bg-orange/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-orange"
              >
                {s.name}
                <button
                  type="button"
                  aria-label={`Remover ${s.name}`}
                  onClick={() => toggle(s.id)}
                  className="rounded-full p-0.5 hover:bg-orange/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-sm">
            <span className="text-gray-neutral">
              {count} serviço{count > 1 ? "s" : ""} · {totalMin}min
            </span>
            <span className="font-heading font-semibold text-graphite">{formatBRL(totalCents)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-neutral">Selecione ao menos um serviço.</p>
      )}
    </div>
  );
}
