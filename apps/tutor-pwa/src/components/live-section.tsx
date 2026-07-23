"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Video, ShieldCheck } from "lucide-react";
import { Button, Card } from "@mylivepet/ui";
import { createClient } from "@/lib/supabase/client";
import {
  getLiveStream,
  grantCameraConsent,
  type LiveStreamState,
} from "@/app/(app)/ao-vivo/actions";
import { LivePlayer } from "./live-player";
import { LiveSteps } from "./live-steps";

/**
 * Seção do ao vivo: reage em tempo real ao status do atendimento (Supabase
 * Realtime em `appointment`) — o player aparece quando o petshop inicia o
 * serviço e some quando finaliza — e renova o token antes de expirar.
 */
export function LiveSection({ initial }: { initial: LiveStreamState }) {
  const [state, setState] = useState<LiveStreamState>(initial);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [granting, startGranting] = useTransition();
  const stateRef = useRef(state);
  stateRef.current = state;

  const refresh = useCallback(async () => {
    setState(await getLiveStream());
  }, []);

  // Mudou qualquer appointment visível ao tutor (RLS) → reavalia o stream.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase.channel("live:appointments");
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment" },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            if (!cancelled) void refresh();
          }, 300);
        },
      );
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Renova o token do stream um pouco antes de expirar.
  useEffect(() => {
    if (state.status !== "live") return;
    const delay = Math.max(state.refreshAt - Date.now(), 5000);
    const timer = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(timer);
  }, [state, refresh]);

  if (state.status === "consent") {
    return (
      <Card className="space-y-3">
        <div className="flex items-center gap-2 text-graphite">
          <ShieldCheck className="h-5 w-5 text-orange" />
          <p className="font-heading font-semibold">Autorização necessária</p>
        </div>
        <p className="text-sm text-gray-neutral">
          O atendimento do seu pet está começando! Para assistir ao vivo e receber a
          gravação, autorize a transmissão e a gravação do atendimento (LGPD). Você pode
          revogar quando quiser falando com o petshop.
        </p>
        {consentError && <p className="text-sm text-danger">{consentError}</p>}
        <Button
          className="w-full"
          disabled={granting}
          onClick={() =>
            startGranting(async () => {
              const result = await grantCameraConsent();
              if (result.ok) await refresh();
              else setConsentError(result.error ?? "Não foi possível salvar");
            })
          }
        >
          {granting ? "Salvando..." : "Autorizar e assistir"}
        </Button>
      </Card>
    );
  }

  if (state.status === "live") {
    return (
      <div className="space-y-3">
        <LivePlayer key={state.whepUrl} whepUrl={state.whepUrl} hlsUrl={state.hlsUrl} />
        <p className="text-sm text-gray-neutral">
          <span className="font-medium text-graphite">
            {state.petName} · {state.serviceName}
          </span>
          {state.roomLabel ? ` — ${state.roomLabel}` : ""}
        </p>
        <LiveSteps appointmentId={state.appointmentId} initial={state.steps} />
      </div>
    );
  }

  return (
    <Card className="flex aspect-video items-center justify-center bg-graphite text-center">
      <div className="px-6">
        <Video className="mx-auto h-8 w-8 text-white/70" />
        <p className="mt-2 font-heading font-semibold text-white">
          {state.status === "offline" ? "Câmera indisponível" : "Nenhum atendimento ao vivo"}
        </p>
        <p className="mt-1 text-sm text-gray-soft/80">
          {state.status === "offline"
            ? "O petshop está finalizando a configuração das câmeras. Tente novamente em breve."
            : "A transmissão aparece aqui automaticamente quando o atendimento do seu pet começar."}
        </p>
      </div>
    </Card>
  );
}
