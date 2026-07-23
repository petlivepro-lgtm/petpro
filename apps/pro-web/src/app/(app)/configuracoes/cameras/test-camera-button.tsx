"use client";

import { useActionState } from "react";
import { Wifi } from "lucide-react";
import { Button } from "@mylivepet/ui";
import { testCamera, type FormState } from "./actions";

/** Cria um path temporário no gateway e verifica se a câmera responde no RTSP. */
export function TestCameraButton({ cameraId }: { cameraId: string }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(testCamera, {
    ok: false,
  });

  return (
    <form action={formAction} className="min-w-0">
      <input type="hidden" name="id" value={cameraId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <Wifi className="h-3.5 w-3.5" />
        {pending ? "Testando... (~10s)" : "Testar conexão"}
      </Button>
      {!pending && state.ok && <p className="mt-1 text-xs text-success">Câmera respondeu ✓</p>}
      {!pending && state.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
