"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  Truck,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Dialog,
  EmptyState,
  StatCard,
  Textarea,
  cn,
} from "@mylivepet/ui";
import { DELIVERY_STOP_KIND_LABEL, DELIVERY_STOP_STATUS_LABEL } from "@mylivepet/types";
import { MapaRota } from "@/components/mapa-rota";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeList } from "@/lib/use-realtime-list";
import { useGeolocation, type Posicao } from "@/lib/use-geolocation";
import {
  fetchRota,
  linksDeNavegacao,
  paradaAtual,
  type ParadaRow,
  type RotaDoDia,
} from "@/lib/rotas";
import {
  finishRoute,
  pushPosition,
  setStopStatus,
  startRoute,
} from "@/app/(app)/rota/actions";

/**
 * A rota do dia do entregador.
 *
 * É client por dois motivos que se somam: o GPS só existe no navegador, e as
 * paradas mudam de status enquanto ele dirige (Realtime). O Server Component
 * que chama este aqui já entregou a rota do dia pronta.
 *
 * O rastreamento começa e termina com a rota, nunca antes: `useGeolocation`
 * recebe `ativo` e o navegador só pede a permissão quando ela vale para
 * alguma coisa.
 */
export function EntregadorRota({
  rota,
  dia,
  sidebar,
}: {
  rota: RotaDoDia;
  dia: string;
  sidebar?: React.ReactNode;
}) {
  const [statusRota, setStatusRota] = useState(rota?.status ?? "PLANNED");
  const [pendente, startTransition] = useTransition();
  const [falha, setFalha] = useState<ParadaRow | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    const r = await fetchRota(createClient(), dia);
    return r?.paradas ?? [];
  }, [dia]);

  const paradas = useRealtimeList(
    rota?.paradas ?? [],
    fetcher,
    [{ table: "delivery_stop" }],
    "rota-entregador",
  );

  /**
   * O id da rota vem das PARADAS quando a prop não o tem.
   *
   * O entregador costuma abrir o painel antes de existir rota nenhuma, e é o
   * gatilho do banco (0065) que a cria quando o petshop aceita um pedido. A
   * parada chega aqui pelo realtime, mas a prop `rota` continua a que foi
   * renderizada no servidor — nula. Sem esta linha a tela seguiria dizendo
   * "nenhuma parada" com as paradas já na mão.
   */
  const rotaId = rota?.id ?? paradas[0]?.routeId ?? null;

  const emRota = statusRota === "IN_PROGRESS";
  const atual = useMemo(() => paradaAtual(paradas), [paradas]);

  // Manda a posição só enquanto a rota corre. O hook já estrangula por tempo e
  // distância; aqui só encaminhamos.
  const onPosicao = useCallback(
    (p: Posicao) => {
      if (!rotaId) return;
      void pushPosition({
        route_id: rotaId,
        lat: p.lat,
        lng: p.lng,
        accuracy_m: p.accuracy,
        heading: p.heading,
        speed_ms: p.speed,
      });
    },
    [rotaId],
  );
  const { posicao, estado: estadoGps } = useGeolocation(emRota, onPosicao);

  // Paradas sem coordenada viram pino depois de uma passada no geocodificador.
  // Uma vez por conjunto de ids: o ref evita repetir a consulta a cada
  // atualização de realtime, e o endereço não muda no meio do dia.
  const jaGeocodificou = useRef<string>("");
  useEffect(() => {
    const semPonto = paradas.filter((p) => !p.temPonto && p.endereco).map((p) => p.id);
    if (!semPonto.length) return;
    const chave = semPonto.sort().join(",");
    if (jaGeocodificou.current === chave) return;
    jaGeocodificou.current = chave;

    void fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stop_ids: semPonto }),
    }).catch(() => {
      // Sem coordenada a parada continua na lista com o endereço escrito.
    });
  }, [paradas]);

  function mudarStatus(parada: ParadaRow, status: string, failReason?: string) {
    setErro(null);
    const fd = new FormData();
    fd.set("stop_id", parada.id);
    fd.set("status", status);
    if (failReason) fd.set("fail_reason", failReason);
    startTransition(async () => {
      const r = await setStopStatus({ ok: false }, fd);
      if (!r.ok) setErro(r.error ?? "Não deu para atualizar a parada");
      else {
        setFalha(null);
        setMotivo("");
      }
    });
  }

  function iniciar() {
    if (!rotaId) return;
    setErro(null);
    startTransition(async () => {
      const r = await startRoute(rotaId);
      if (r.ok) setStatusRota("IN_PROGRESS");
      else setErro(r.error ?? "Não deu para iniciar a rota");
    });
  }

  function encerrar() {
    if (!rotaId) return;
    startTransition(async () => {
      const r = await finishRoute(rotaId);
      if (r.ok) setStatusRota("DONE");
      else setErro(r.error ?? "Não deu para encerrar a rota");
    });
  }

  const feitas = paradas.filter((p) => p.status === "DONE").length;
  const pendentes = paradas.filter((p) => p.status === "PENDING").length;

  if (!rotaId || paradas.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<Truck className="h-6 w-6" />}
          title="Nenhuma parada para hoje"
          description="Quando o petshop marcar um atendimento para buscar ou devolver em casa, ele aparece aqui."
        />
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Paradas"
            value={paradas.length}
            hint="no dia"
            icon={<MapPin className="h-5 w-5" />}
            accent="#1D4E5F"
          />
          <StatCard
            label="A fazer"
            value={pendentes}
            hint="ainda faltam"
            icon={<Truck className="h-5 w-5" />}
            accent="#FF6A00"
          />
          <StatCard
            label="Concluídas"
            value={feitas}
            hint="entregues/buscadas"
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="#2E9E5B"
          />
        </div>

        {erro && (
          <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {erro}
          </p>
        )}

        <Card className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-neutral">
                {emRota ? "Rota em andamento" : "Rota de hoje"}
              </p>
              {atual && (
                <p className="font-heading text-lg font-semibold text-graphite">
                  {DELIVERY_STOP_KIND_LABEL[atual.kind]} {atual.petName}
                </p>
              )}
            </div>

            {statusRota === "PLANNED" && (
              <Button onClick={iniciar} disabled={pendente}>
                <Play className="mr-2 h-4 w-4" />
                Iniciar rota
              </Button>
            )}
            {emRota && (
              <Button variant="secondary" onClick={encerrar} disabled={pendente}>
                Encerrar rota
              </Button>
            )}
          </div>

          {emRota && estadoGps === "negado" && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-[#8a6418]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Sem acesso à sua localização. A lista de paradas continua
              funcionando — use o botão Navegar para seguir pelo Waze ou Google
              Maps.
            </p>
          )}

          <MapaRota paradas={paradas} posicao={posicao} destino={atual} />
        </Card>

        <div className="mt-6 space-y-3">
          {paradas.map((parada) => (
            <ParadaCard
              key={parada.id}
              parada={parada}
              destaque={atual?.id === parada.id}
              emRota={emRota}
              pendente={pendente}
              onStatus={mudarStatus}
              onFalha={() => setFalha(parada)}
            />
          ))}
        </div>
      </div>

      {sidebar && <div className="space-y-4">{sidebar}</div>}

      <Dialog
        open={falha !== null}
        onOpenChange={(aberto) => !aberto && setFalha(null)}
        title="Não consegui fazer esta parada"
      >
        <p className="mb-3 text-sm text-gray-neutral">
          O petshop precisa saber o que houve para ligar para o tutor. O tutor
          não recebe este aviso.
        </p>
        <Textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: ninguém atendeu no portão"
          rows={3}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setFalha(null)}>
            Voltar
          </Button>
          <Button
            variant="danger"
            disabled={pendente || motivo.trim() === ""}
            onClick={() => falha && mudarStatus(falha, "FAILED", motivo)}
          >
            Registrar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function ParadaCard({
  parada,
  destaque,
  emRota,
  pendente,
  onStatus,
  onFalha,
}: {
  parada: ParadaRow;
  destaque: boolean;
  emRota: boolean;
  pendente: boolean;
  onStatus: (p: ParadaRow, status: string) => void;
  onFalha: () => void;
}) {
  const links = linksDeNavegacao(parada);
  const concluida = parada.status === "DONE" || parada.status === "FAILED";

  return (
    <Card className={cn(destaque && "bg-orange/5 ring-1 ring-orange/30")}>
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-petrol/10 text-sm font-semibold text-petrol">
          {parada.position}
        </span>
        <Avatar name={parada.petName} src={parada.petPhoto} />

        <div className="min-w-0 flex-1">
          <p className="font-medium text-graphite">
            {DELIVERY_STOP_KIND_LABEL[parada.kind]} · {parada.petName}
          </p>
          <p className="text-sm text-gray-neutral">
            {parada.tutorName}
            {parada.serviceName ? ` · ${parada.serviceName}` : ""}
          </p>
          <p className="mt-1 text-sm text-graphite">
            {parada.endereco ?? (
              <span className="text-danger">
                Cadastro sem endereço — fale com o petshop
              </span>
            )}
          </p>
          {parada.failReason && (
            <p className="mt-1 text-sm text-danger">
              Não realizada: {parada.failReason}
            </p>
          )}
        </div>

        <span className="text-xs font-medium text-gray-neutral">
          {DELIVERY_STOP_STATUS_LABEL[parada.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {parada.tutorPhone && (
          <a href={`tel:${parada.tutorPhone}`}>
            <Button variant="secondary" size="sm">
              <Phone className="mr-1.5 h-4 w-4" />
              Ligar
            </Button>
          </a>
        )}
        {links && (
          <a href={links.waze} target="_blank" rel="noreferrer">
            <Button variant="secondary" size="sm">
              <Navigation className="mr-1.5 h-4 w-4" />
              Navegar
            </Button>
          </a>
        )}

        {emRota && !concluida && parada.status === "PENDING" && (
          <Button size="sm" disabled={pendente} onClick={() => onStatus(parada, "EN_ROUTE")}>
            <Truck className="mr-1.5 h-4 w-4" />
            Sair para esta parada
          </Button>
        )}
        {emRota && parada.status === "EN_ROUTE" && (
          <>
            <Button size="sm" disabled={pendente} onClick={() => onStatus(parada, "DONE")}>
              <PackageCheck className="mr-1.5 h-4 w-4" />
              {parada.kind === "PICKUP" ? "Peguei o pet" : "Entreguei"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pendente} onClick={onFalha}>
              Não consegui
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
