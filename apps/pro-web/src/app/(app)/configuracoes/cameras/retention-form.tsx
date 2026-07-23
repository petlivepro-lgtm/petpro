"use client";

import { useActionState } from "react";
import { Clock } from "lucide-react";
import { Button, Card, CardTitle, Label, Select } from "@mylivepet/ui";
import { RECORDING_RETENTION_OPTIONS } from "@mylivepet/types";
import { updateRetention, type FormState } from "./actions";

/** Por quantos dias as gravações ficam disponíveis para o tutor. */
export function RetentionForm({ days }: { days: number }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(updateRetention, {
    ok: false,
  });

  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <Clock className="h-4 w-4" /> Retenção das gravações
      </CardTitle>
      <p className="mt-1 text-sm text-gray-neutral">
        Após esse prazo, a gravação é apagada automaticamente e some do app do tutor.
      </p>

      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label htmlFor="retention_days">Guardar por</Label>
          <Select id="retention_days" name="retention_days" defaultValue={String(days)}>
            {RECORDING_RETENTION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} dias
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        {!pending && state.ok && <p className="text-xs text-success">Salvo ✓</p>}
        {!pending && state.error && <p className="text-xs text-danger">{state.error}</p>}
      </form>
    </Card>
  );
}
