"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Checkbox,
  CurrencyInput,
  Dialog,
  Input,
  Label,
} from "@mylivepet/ui";
import type { SizePrices } from "@mylivepet/types";
import { SizePriceFields } from "@/components/size-price-fields";
import {
  createServiceAddon,
  deleteServiceAddon,
  updateServiceAddon,
  type FormState,
} from "@/app/(app)/servicos/actions";
import { useOpenFromUrl } from "@/lib/use-open-from-url";

export type AddonRow = SizePrices & {
  id: string;
  name: string;
  /** Preço base: vale para porte sem preço próprio e para pet sem porte. */
  price_cents: number;
  active: boolean;
};

/**
 * Cadastro do serviço adicional (0056). Ao contrário do serviço, ele só tem
 * nome e preço: não ocupa horário na agenda, não tem etapas nem cor.
 */
export function AddonDialog({ addon }: { addon?: AddonRow }) {
  const router = useRouter();
  const isEdit = !!addon;
  const [open, setOpen] = useState(false);

  // Só o gatilho de cadastro responde à paleta; com adicional é edição.
  useOpenFromUrl("adicional", () => setOpen(true), !addon);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    isEdit ? updateServiceAddon : createServiceAddon,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Editar ${addon!.name}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Novo adicional
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar adicional" : "Novo serviço adicional"}
        description="Extra que acompanha o atendimento, escolhido junto do serviço no agendamento."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={addon!.id} />}

          <div>
            <Label htmlFor="addon-name">Nome *</Label>
            <Input
              id="addon-name"
              name="name"
              required
              maxLength={60}
              defaultValue={addon?.name}
              placeholder="Ex.: Hidratação"
            />
          </div>

          <div>
            <Label htmlFor="addon-price">Preço base *</Label>
            <CurrencyInput
              id="addon-price"
              name="price"
              required
              defaultCents={addon?.price_cents}
            />
          </div>

          <SizePriceFields idPrefix="addon" values={addon} />

          <Checkbox
            name="active"
            defaultChecked={addon ? addon.active : true}
            label="Ativo (aparece no agendamento)"
          />

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteAddonDialog({ addon }: { addon: AddonRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    deleteServiceAddon,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Excluir ${addon.name}`}
        className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir adicional?"
        description={addon.name}
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={addon.id} />
          <p className="text-sm text-graphite">
            O adicional sai do catálogo. Atendimentos que já o usaram mantêm o
            nome e o valor cobrados na época. Para apenas tirá-lo do
            agendamento, desative-o em vez de excluir.
          </p>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
