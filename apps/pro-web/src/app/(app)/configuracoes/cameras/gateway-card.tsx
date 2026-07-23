"use client";

import { useActionState, useState } from "react";
import { Copy, ServerCog, Wifi } from "lucide-react";
import { Button, Card, CardTitle, Input, Label } from "@mylivepet/ui";
import { saveGateway, testGateway, type FormState, type GatewayFormState } from "./actions";

export type GatewayInfo = {
  tunnelUrl: string;
  apiTunnelUrl: string;
  lastSeenAt: string | null;
};

/**
 * Configuração do gateway local (MediaMTX + Cloudflare Tunnel no PC do petshop).
 * Salvar gera um novo token do uploader, exibido uma única vez — no banco fica
 * só o hash, então rotacionar o token exige salvar de novo e atualizar o .env.
 */
export function GatewayCard({ gateway }: { gateway: GatewayInfo | null }) {
  const [state, formAction, pending] = useActionState<GatewayFormState, FormData>(saveGateway, {
    ok: false,
  });
  const [pingState, pingAction, pinging] = useActionState<FormState, FormData>(testGateway, {
    ok: false,
  });
  const [copied, setCopied] = useState(false);

  const configured = !!gateway;

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ServerCog className="h-4 w-4" /> Gateway de câmeras
          </CardTitle>
          <p className="mt-1 text-sm text-gray-neutral">
            Programa instalado uma vez num PC do petshop, que conecta as câmeras ao app.
            Siga o passo a passo do arquivo <code>infra/petshop-gateway/INSTALL.md</code>.
          </p>
        </div>
        {configured && (
          <form action={pingAction}>
            <Button type="submit" variant="secondary" size="sm" disabled={pinging}>
              <Wifi className="h-3.5 w-3.5" /> {pinging ? "Verificando..." : "Verificar"}
            </Button>
          </form>
        )}
      </div>

      {configured && !pinging && (pingState.ok || pingState.error) && (
        <p className={`mt-2 text-xs ${pingState.ok ? "text-success" : "text-danger"}`}>
          {pingState.ok ? "Gateway online ✓" : pingState.error}
        </p>
      )}
      {configured && gateway?.lastSeenAt && (
        <p className="mt-1 text-xs text-gray-neutral">
          Último contato do gateway: {new Date(gateway.lastSeenAt).toLocaleString("pt-BR")}
        </p>
      )}

      <form action={formAction} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tunnel_url">URL de transmissão (tunnel)</Label>
            <Input
              id="tunnel_url"
              name="tunnel_url"
              required
              defaultValue={gateway?.tunnelUrl}
              placeholder="https://cam-seupetshop.exemplo.com"
            />
          </div>
          <div>
            <Label htmlFor="api_tunnel_url">URL de controle (tunnel)</Label>
            <Input
              id="api_tunnel_url"
              name="api_tunnel_url"
              required
              defaultValue={gateway?.apiTunnelUrl}
              placeholder="https://camapi-seupetshop.exemplo.com"
            />
          </div>
        </div>

        {state.ok && state.token && (
          <div className="rounded-xl border border-orange/30 bg-orange/5 p-3">
            <p className="text-sm font-medium text-graphite">
              Token do gateway gerado — copie agora, ele não será mostrado de novo:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-graphite/5 px-2 py-1 text-xs">
                {state.token}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(state.token!);
                  setCopied(true);
                }}
              >
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-neutral">
              Cole no arquivo <code>.env</code> do gateway (variável{" "}
              <code>GATEWAY_UPLOAD_TOKEN</code>) e reinicie com{" "}
              <code>docker compose up -d</code>.
            </p>
          </div>
        )}

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Salvando..."
              : configured
                ? "Salvar e gerar novo token"
                : "Salvar e gerar token"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
