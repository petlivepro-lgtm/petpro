"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  PasswordInput,
  Select,
} from "@mylivepet/ui";
import { upsertCamera, type FormState } from "./actions";

export type CameraRow = {
  id: string;
  room_label: string;
  host: string;
  port: number;
  stream_path: string;
  username: string;
  active: boolean;
};

export function CameraDialog({ camera }: { camera?: CameraRow }) {
  const router = useRouter();
  const isEdit = !!camera;
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    upsertCamera,
    {
      ok: false,
    },
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
          aria-label={`Editar ${camera!.room_label}`}
          className="rounded-lg p-2 text-gray-neutral transition-colors hover:bg-orange/10 hover:text-orange"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nova câmera
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={isEdit ? "Editar câmera" : "Nova câmera"}
        description="Uma câmera por sala de atendimento (Tapo C200 ou compatível com RTSP)."
      >
        <form action={formAction} className="space-y-4">
          {isEdit && <input type="hidden" name="id" value={camera!.id} />}

          <div>
            <Label htmlFor="room_label">Sala *</Label>
            <Input
              id="room_label"
              name="room_label"
              required
              defaultValue={camera?.room_label}
              placeholder="Ex.: Sala de banho 1"
            />
          </div>

          <div className="grid grid-cols-[1fr_6.5rem] gap-2">
            <div>
              <Label htmlFor="host">IP da câmera na rede local *</Label>
              <Input
                id="host"
                name="host"
                required
                defaultValue={camera?.host}
                placeholder="Ex.: 192.168.1.50"
              />
            </div>
            <div>
              <Label htmlFor="port">Porta</Label>
              <Input
                id="port"
                name="port"
                type="number"
                min={1}
                max={65535}
                defaultValue={camera?.port ?? 554}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-neutral">
            Veja o IP no app Tapo (Configurações do Dispositivo) e fixe-o no
            roteador (reserva DHCP) para ele não mudar.
          </p>

          <div>
            <Label htmlFor="stream_path">Qualidade da transmissão</Label>
            <Select
              id="stream_path"
              name="stream_path"
              defaultValue={camera?.stream_path ?? "stream1"}
            >
              <option value="stream1">Alta (1080p) — recomendado</option>
              <option value="stream2">Leve (360p) — internet fraca</option>
            </Select>
          </div>

          <div className="rounded-xl border border-graphite/10 bg-graphite/[0.03] p-3">
            <p className="text-xs text-gray-neutral">
              Crie a <strong>Conta da Câmera</strong> no app Tapo: Configurações
              do Dispositivo → Configurações Avançadas → Conta da Câmera (6 a 32
              caracteres, diferente da conta TP-Link) e informe-a abaixo.
            </p>
          </div>

          <div>
            <Label htmlFor="username">Usuário da Conta da Câmera *</Label>
            <Input
              id="username"
              name="username"
              required
              defaultValue={camera?.username}
            />
          </div>

          <div>
            <Label htmlFor="password">
              Senha da Conta da Câmera {isEdit ? "" : "*"}
            </Label>
            <PasswordInput
              id="password"
              name="password"
              required={!isEdit}
              placeholder={isEdit ? "Deixe em branco para manter a atual" : ""}
              autoComplete="new-password"
            />
          </div>

          <Checkbox
            name="active"
            defaultChecked={camera ? camera.active : true}
            label="Ativa (disponível ao iniciar atendimentos)"
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
