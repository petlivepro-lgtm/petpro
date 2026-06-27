import { createClient } from "@/lib/supabase/server";
import { Button, Card, Label, Select, DatePicker } from "@mylivepet/ui";
import { formatBRL } from "@mylivepet/types";
import { requestBooking } from "../actions";

export default async function AgendarPage() {
  const supabase = await createClient();
  const [{ data: pets }, { data: services }] = await Promise.all([
    supabase.from("pet").select("id, name"),
    supabase.from("service_type").select("id, name, price_cents, duration_min").eq("active", true),
  ]);

  return (
    <div className="space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="font-heading text-xl font-bold text-graphite lg:text-2xl">Agendar serviço</h1>
        <p className="text-sm text-gray-neutral">
          Envie sua solicitação — o petshop confirma o horário.
        </p>
      </header>

      <Card>
        <form action={requestBooking} className="space-y-4">
          <div>
            <Label htmlFor="pet_id">Pet</Label>
            <Select id="pet_id" name="pet_id" required>
              {(pets ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="service_type_id">Serviço</Label>
            <Select id="service_type_id" name="service_type_id" required>
              {(services ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatBRL(s.price_cents)} · {s.duration_min}min
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="scheduled_at">Data e horário desejados</Label>
            <DatePicker id="scheduled_at" name="scheduled_at" mode="datetime" required />
          </div>

          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="w-full rounded-xl border border-graphite/15 bg-surface p-3 text-sm"
              placeholder="Ex.: meu pet fica ansioso com secador."
            />
          </div>

          <Button type="submit" className="w-full">
            Enviar solicitação
          </Button>
          <p className="text-center text-xs text-gray-neutral">
            Transparência para você. Processo para o petshop.
          </p>
        </form>
      </Card>
    </div>
  );
}
