"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Home,
  Map as MapIcon,
  Navigation,
  PackageCheck,
  Phone,
  Play,
  RotateCcw,
  Square,
  Store,
  Truck,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  Dialog,
  EmptyState,
  PageHeader,
  StatusChip,
  Textarea,
  cn,
} from "@mylivepet/ui";
import {
  DELIVERY_ROUTE_STATUS_LABEL,
  DELIVERY_STOP_KIND_LABEL,
  type DeliveryRouteStatus,
  type DeliveryVehicle,
} from "@mylivepet/types";
import { MapaRota, type PontoDestino } from "@/components/mapa-rota";
import { useGeolocation, type Posicao } from "@/lib/use-geolocation";
import { useParadasDoDia } from "@/lib/use-paradas-do-dia";
import type { LocalPetshop } from "@/lib/entregador-dia";
import {
  agruparParadas,
  horaSP,
  paradaAtual,
  horarioDaParada,
  linksDeNavegacao,
  type ParadaRow,
  type RotaDoDia,
} from "@/lib/rotas";
import {
  arriveAtShop,
  finishRoute,
  pushPosition,
  setStopStatus,
  startRoute,
} from "@/app/(app)/rota/actions";

const TOM_ROTA: Record<DeliveryRouteStatus, "neutral" | "brand" | "success" | "danger"> = {
  PLANNED: "neutral",
  IN_PROGRESS: "brand",
  DONE: "success",
  CANCELLED: "danger",
};

/**
 * A tela de trabalho do entregador (/rota).
 *
 * Não é uma fila: as paradas vêm agrupadas pelo que dá para fazer com cada uma
 * (buscar, levar ao petshop, entregar, esperar o banho), e ele escolhe a
 * ordem. Tocar em "Buscar" ou "Entregar" já põe a rota em andamento — liga o
 * GPS e o mapa ao vivo do tutor — e o botão "Iniciar rota" continua ali para
 * quem quer seguir pelo app antes de escolher a primeira parada.
 *
 * É client por dois motivos que se somam: o GPS só existe no navegador, e as
 * paradas mudam de status enquanto ele dirige (Realtime).
 */
export function EntregadorRota({
  rota,
  dia,
  subtitulo,
  petshop,
  veiculo,
}: {
  rota: RotaDoDia;
  dia: string;
  subtitulo: string;
  petshop: LocalPetshop | null;
  veiculo: DeliveryVehicle | null;
}) {
  const [statusRota, setStatusRota] = useState<DeliveryRouteStatus>(
    rota?.status ?? "PLANNED",
  );
  const [pendente, startTransition] = useTransition();
  const [falha, setFalha] = useState<ParadaRow | null>(null);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState<ParadaRow | null>(null);
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false);
  const [navPara, setNavPara] = useState<{ url: string; app: string; pet: string } | null>(
    null,
  );
  const [naoAvisarHoje, setNaoAvisarHoje] = useState(false);

  const { paradas, rotaId } = useParadasDoDia(rota, dia, "rota-entregador");
  const g = useMemo(() => agruparParadas(paradas), [paradas]);

  const emRota = statusRota === "IN_PROGRESS";
  const abertas = paradas.length - g.encerradas.length;
  const ocupado = g.aCaminho.length > 0;

  // A próxima parada que dá para fazer — o destino sugerido quando ele ainda
  // não escolheu nenhuma.
  const sugerida = useMemo(() => paradaAtual(paradas), [paradas]);

  // Para onde ele vai agora: a casa da parada a caminho; senão, com pets no
  // veículo, o petshop; senão, a próxima parada sugerida — tracejada, porque
  // ele ainda não saiu para ela. Sem este último caso, a rota iniciada pelo
  // botão (antes de tocar em Buscar) ficava sem linha nenhuma no mapa.
  const destino: PontoDestino | null = useMemo(() => {
    const indo = g.aCaminho.find((p) => p.temPonto);
    if (indo) return { lat: indo.lat!, lng: indo.lng!, rotulo: `a casa de ${indo.petName}` };
    if (g.comVoce.length && petshop) {
      return { lat: petshop.lat, lng: petshop.lng, rotulo: "o petshop" };
    }
    if (sugerida?.temPonto) {
      return {
        lat: sugerida.lat!,
        lng: sugerida.lng!,
        rotulo: `a próxima parada (${sugerida.petName})`,
        sugestao: true,
      };
    }
    return null;
  }, [g, petshop, sugerida]);

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
        if (r.rotaEmAndamento) setStatusRota("IN_PROGRESS");
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
      setConfirmarEncerrar(false);
      if (r.ok) setStatusRota("DONE");
      else setErro(r.error ?? "Não deu para encerrar a rota");
    });
  }

  /**
   * Waze e Maps tiram o nosso app da tela, e o navegador para o GPS de app em
   * segundo plano — o tutor, que está acompanhando, vê a moto parar. O
   * entregador pode ir assim mesmo; só precisa saber. "Não avisar hoje" fica
   * no aparelho (localStorage): é conveniência dele, e some no dia seguinte.
   */
  const chaveAviso = `rota:aviso-navegacao:${dia}`;
  function aoNavegar(e: React.MouseEvent, url: string, app: string, pet: string) {
    try {
      if (localStorage.getItem(chaveAviso)) return;
    } catch {
      // Sem storage (aba anônima): avisa sempre, que é o lado seguro.
    }
    e.preventDefault();
    setNaoAvisarHoje(false);
    setNavPara({ url, app, pet });
  }

  function abrirNavegacao() {
    if (!navPara) return;
    if (naoAvisarHoje) {
      try {
        localStorage.setItem(chaveAviso, "1");
      } catch {
        // idem: sem storage, o aviso volta na próxima vez.
      }
    }
    window.open(navPara.url, "_blank", "noopener,noreferrer");
    setNavPara(null);
  }

  function cheguei() {
    if (!rotaId) return;
    setErro(null);
    startTransition(async () => {
      const r = await arriveAtShop(rotaId);
      if (!r.ok) setErro(r.error ?? "Não deu para registrar a chegada");
    });
  }

  if (!rotaId || paradas.length === 0) {
    return (
      <div>
        <PageHeader title="Minha rota" subtitle={subtitulo} />
        <Card>
          <EmptyState
            icon={<Truck className="h-6 w-6" />}
            title="Nenhuma parada para hoje"
            description="Quando o petshop marcar um atendimento para buscar ou devolver em casa, ele aparece aqui."
          />
        </Card>
      </div>
    );
  }

  // Um só botão, desenhado em dois lugares: no cabeçalho a partir do tablet e
  // na barra fixa do rodapé no celular, onde o polegar alcança.
  const botaoRota =
    statusRota === "PLANNED" ? (
      <Button onClick={iniciar} disabled={pendente} className="w-full md:w-auto">
        <Play className="h-4 w-4" />
        Iniciar rota
      </Button>
    ) : statusRota === "DONE" && abertas > 0 ? (
      <Button onClick={iniciar} disabled={pendente} className="w-full md:w-auto">
        <RotateCcw className="h-4 w-4" />
        Retomar rota
      </Button>
    ) : emRota ? (
      <Button
        variant="secondary"
        onClick={() => (abertas > 0 ? setConfirmarEncerrar(true) : encerrar())}
        disabled={pendente}
        className="w-full md:w-auto"
      >
        <Square className="h-4 w-4" />
        Encerrar rota
      </Button>
    ) : null;

  const linhaAcao = (p: ParadaRow, rotulo: string, icone: React.ReactNode) => (
    <LinhaParada
      key={p.id}
      parada={p}
      onFocar={() => setFoco({ ...p })}
      acao={
        <Button
          size="sm"
          disabled={pendente || ocupado}
          onClick={() => mudarStatus(p, "EN_ROUTE")}
          title={ocupado ? "Termine a parada em andamento primeiro" : undefined}
        >
          {icone}
          {rotulo}
        </Button>
      }
    />
  );

  return (
    <div className={cn(botaoRota && "pb-24 md:pb-0")}>
      <PageHeader
        title="Minha rota"
        subtitle={subtitulo}
        actions={
          <>
            <StatusChip tone={TOM_ROTA[statusRota]}>
              {DELIVERY_ROUTE_STATUS_LABEL[statusRota]} · {g.encerradas.length}/
              {paradas.length}
            </StatusChip>
            {botaoRota && <div className="hidden md:block">{botaoRota}</div>}
          </>
        }
      />

      {erro && (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{erro}</p>
      )}

      {statusRota === "DONE" && abertas > 0 && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-[#8a6418]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Rota encerrada com {abertas} {abertas === 1 ? "parada pendente" : "paradas pendentes"}.
          Retome para continuar — ou toque em Buscar/Entregar numa delas.
        </p>
      )}

      {emRota && estadoGps === "negado" && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm text-[#8a6418]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Sem acesso à sua localização. A lista de paradas continua funcionando —
          use o botão Waze ou Maps para seguir.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-6">
        <Card className="p-2 sm:p-3 lg:sticky lg:top-6 lg:self-start">
          <MapaRota
            paradas={paradas}
            posicao={posicao}
            destino={destino}
            destaqueId={g.aCaminho[0]?.id ?? (g.comVoce.length ? null : sugerida?.id) ?? null}
            foco={foco}
            petshop={petshop}
            veiculo={veiculo}
            className="h-[45vh] min-h-[280px] lg:h-[calc(100vh-11rem)]"
          />
        </Card>

        <div className="min-w-0 space-y-4">
          {g.aCaminho.map((p) => (
            <ParadaACaminho
              key={p.id}
              parada={p}
              pendente={pendente}
              onStatus={mudarStatus}
              onFalha={() => setFalha(p)}
              onVerNoMapa={() => setFoco({ ...p })}
              onNavegar={(e, url, app) => aoNavegar(e, url, app, p.petName)}
            />
          ))}

          {g.comVoce.length > 0 && (
            <ComVoce
              pets={g.comVoce}
              petshop={petshop}
              pendente={pendente}
              onCheguei={cheguei}
            />
          )}

          {g.paraBuscar.length > 0 && (
            <Grupo titulo="Para buscar" total={g.paraBuscar.length}>
              {g.paraBuscar.map((p) =>
                linhaAcao(p, "Buscar", <Truck className="h-4 w-4" />),
              )}
            </Grupo>
          )}

          {g.prontasParaEntregar.length > 0 && (
            <Grupo
              titulo="Prontos para entregar"
              total={g.prontasParaEntregar.length}
              destaque
            >
              {g.prontasParaEntregar.map((p) =>
                linhaAcao(p, "Entregar", <Home className="h-4 w-4" />),
              )}
            </Grupo>
          )}

          {g.aguardandoAtendimento.length > 0 && (
            <Grupo
              titulo="Aguardando atendimento"
              total={g.aguardandoAtendimento.length}
              dica="O botão Entregar aparece quando o banho terminar."
            >
              {g.aguardandoAtendimento.map((p) => (
                <LinhaParada key={p.id} parada={p} onFocar={() => setFoco({ ...p })} />
              ))}
            </Grupo>
          )}

          {abertas === 0 && (
            <Card>
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Todas as paradas feitas"
                description={
                  emRota
                    ? "Encerre a rota para desligar o compartilhamento da sua localização."
                    : "Nada mais para hoje."
                }
              />
            </Card>
          )}

          {g.encerradas.length > 0 && (
            <Card className="p-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-base font-semibold text-graphite">
                    Concluídas
                    <span className="ml-2 text-sm font-normal text-gray-neutral">
                      {g.encerradas.length}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 text-gray-neutral transition-transform group-open:rotate-180" />
                </summary>
                <ul className="divide-y divide-graphite/5 border-t border-graphite/5">
                  {g.encerradas.map((p) => (
                    <LinhaParada key={p.id} parada={p} onFocar={() => setFoco({ ...p })} />
                  ))}
                </ul>
              </details>
            </Card>
          )}
        </div>
      </div>

      {botaoRota && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-graphite/10 bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          {botaoRota}
        </div>
      )}

      <ConfirmDialog
        open={navPara !== null}
        onOpenChange={(aberto) => !aberto && setNavPara(null)}
        title={`Abrir o ${navPara?.app ?? "navegador"}?`}
        description={`Enquanto você estiver no ${navPara?.app ?? "outro app"}, o celular para de enviar sua localização e o tutor de ${navPara?.pet ?? "pet"} deixa de ver você andando no mapa. Volte para cá quando chegar, para marcar a parada.`}
        confirmLabel={`Abrir ${navPara?.app ?? ""}`.trim()}
        cancelLabel="Seguir pelo app"
        onConfirm={abrirNavegacao}
      >
        <Checkbox
          label="Não avisar de novo hoje"
          checked={naoAvisarHoje}
          onChange={(e) => setNaoAvisarHoje(e.target.checked)}
        />
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmarEncerrar}
        onOpenChange={setConfirmarEncerrar}
        title="Encerrar a rota?"
        description={`Ainda ${abertas === 1 ? "falta 1 parada" : `faltam ${abertas} paradas`}. Encerrando, sua localização deixa de ser compartilhada — dá para retomar depois.`}
        confirmLabel="Encerrar mesmo assim"
        confirmVariant="danger"
        onConfirm={encerrar}
        pending={pendente}
      />

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

/** A parada em andamento: tudo o que ele precisa tocar sem procurar. */
function ParadaACaminho({
  parada,
  pendente,
  onStatus,
  onFalha,
  onVerNoMapa,
  onNavegar,
}: {
  parada: ParadaRow;
  pendente: boolean;
  onStatus: (p: ParadaRow, status: string) => void;
  onFalha: () => void;
  onVerNoMapa: () => void;
  onNavegar: (e: React.MouseEvent, url: string, app: string) => void;
}) {
  const links = linksDeNavegacao(parada);
  const busca = parada.kind === "PICKUP";

  return (
    <Card className="ring-1 ring-orange/30">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-orange">
        {busca ? "Indo buscar" : "Levando para casa"}
      </p>

      <div className="flex items-start gap-3">
        <Avatar name={parada.petName} src={parada.petPhoto} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-semibold text-graphite">
            {DELIVERY_STOP_KIND_LABEL[parada.kind]} {parada.petName}
          </p>
          <p className="truncate text-sm text-gray-neutral">
            {parada.tutorName}
            {parada.serviceName ? ` · ${parada.serviceName}` : ""}
          </p>
          {busca && horaSP(parada.scheduledAt) && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-graphite">
              <Clock className="h-3.5 w-3.5 text-gray-neutral" />
              Atendimento às{" "}
              <span className="font-medium tabular-nums">{horaSP(parada.scheduledAt)}</span>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onVerNoMapa}
        disabled={!parada.temPonto}
        className="mt-3 flex w-full items-start gap-2 rounded-xl bg-surface-muted px-3 py-2.5 text-left text-sm text-graphite disabled:cursor-default"
      >
        <MapIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-neutral" />
        {parada.endereco ?? (
          <span className="text-danger">Cadastro sem endereço — fale com o petshop</span>
        )}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {links && (
          <>
            <a
              href={links.waze}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => onNavegar(e, links.waze, "Waze")}
            >
              <Button variant="secondary" className="w-full">
                <Navigation className="h-4 w-4" />
                Waze
              </Button>
            </a>
            <a
              href={links.maps}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => onNavegar(e, links.maps, "Google Maps")}
            >
              <Button variant="secondary" className="w-full">
                <MapIcon className="h-4 w-4" />
                Maps
              </Button>
            </a>
          </>
        )}
        {parada.tutorPhone && (
          <a
            href={`tel:${parada.tutorPhone}`}
            className={cn(links && "col-span-2 sm:col-span-1")}
          >
            <Button variant="secondary" className="w-full">
              <Phone className="h-4 w-4" />
              Ligar
            </Button>
          </a>
        )}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2">
        <Button
          disabled={pendente}
          onClick={() => onStatus(parada, busca ? "PICKED_UP" : "DONE")}
        >
          <PackageCheck className="h-4 w-4" />
          {busca ? "Peguei o pet" : "Entreguei ao tutor"}
        </Button>
        <Button variant="ghost" disabled={pendente} onClick={onFalha}>
          Não consegui
        </Button>
      </div>
      <button
        type="button"
        disabled={pendente}
        onClick={() => onStatus(parada, "PENDING")}
        className="mt-2 flex w-full items-center justify-center gap-1.5 py-1 text-xs text-gray-neutral hover:text-graphite"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Saí para a parada errada
      </button>
    </Card>
  );
}

/** Pets no veículo, a caminho do petshop. */
function ComVoce({
  pets,
  petshop,
  pendente,
  onCheguei,
}: {
  pets: ParadaRow[];
  petshop: LocalPetshop | null;
  pendente: boolean;
  onCheguei: () => void;
}) {
  const ll = petshop ? `${petshop.lat},${petshop.lng}` : null;

  return (
    <Card className="bg-petrol/5 ring-1 ring-petrol/20">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-petrol">
        Com você · levar ao petshop
      </p>
      <ul className="space-y-2">
        {pets.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Avatar name={p.petName} src={p.petPhoto} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-graphite">
              {p.petName}
              <span className="font-normal text-gray-neutral">
                {p.serviceName ? ` · ${p.serviceName}` : ""}
              </span>
            </span>
            {horaSP(p.scheduledAt) && (
              <span className="shrink-0 text-xs tabular-nums text-gray-neutral">
                atend. {horaSP(p.scheduledAt)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        {ll && (
          <a
            href={`https://waze.com/ul?ll=${ll}&navigate=yes`}
            target="_blank"
            rel="noreferrer"
          >
            <Button variant="secondary" className="w-full">
              <Navigation className="h-4 w-4" />
              Waze
            </Button>
          </a>
        )}
        <Button disabled={pendente} onClick={onCheguei}>
          <Store className="h-4 w-4" />
          Entreguei no petshop
          {pets.length > 1 ? ` (${pets.length})` : ""}
        </Button>
      </div>
    </Card>
  );
}

function Grupo({
  titulo,
  total,
  dica,
  destaque,
  children,
}: {
  titulo: string;
  total: number;
  dica?: string;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("p-0", destaque && "ring-1 ring-success/30")}>
      <div className="px-4 pb-2 pt-4 sm:px-5">
        <h2 className="font-heading text-base font-semibold text-graphite">
          {titulo}
          <span className="ml-2 text-sm font-normal text-gray-neutral">{total}</span>
        </h2>
        {dica && <p className="text-xs text-gray-neutral">{dica}</p>}
      </div>
      <ul className="divide-y divide-graphite/5">{children}</ul>
    </Card>
  );
}

/** Uma linha compacta — tocar nela mostra a parada no mapa. */
function LinhaParada({
  parada,
  onFocar,
  acao,
}: {
  parada: ParadaRow;
  onFocar: () => void;
  acao?: React.ReactNode;
}) {
  const { hora, legenda } = horarioDaParada(parada);
  const encerrada = parada.status === "DONE" || parada.status === "FAILED";

  return (
    <li className="flex items-center gap-2 pr-3 sm:pr-4">
      <button
        type="button"
        onClick={onFocar}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left hover:bg-surface-muted/60 sm:pl-5"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            parada.status === "DONE"
              ? "bg-success/10 text-success"
              : parada.status === "FAILED"
                ? "bg-danger/10 text-danger"
                : "bg-petrol/10 text-petrol",
          )}
        >
          {parada.status === "DONE" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : parada.status === "FAILED" ? (
            <XCircle className="h-4 w-4" />
          ) : (
            parada.position
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              encerrada ? "text-gray-neutral" : "text-graphite",
            )}
          >
            {DELIVERY_STOP_KIND_LABEL[parada.kind]} · {parada.petName}
          </span>
          <span className="block truncate text-xs text-gray-neutral">
            {parada.failReason
              ? `Não realizada: ${parada.failReason}`
              : (parada.bairro ?? parada.endereco ?? "Sem endereço")}
          </span>
        </span>
        {hora && (
          <span className="shrink-0 text-right">
            <span className="block text-sm tabular-nums text-graphite">{hora}</span>
            {legenda && (
              <span className="block text-[11px] leading-tight text-gray-neutral">
                {legenda}
              </span>
            )}
          </span>
        )}
      </button>
      {acao}
    </li>
  );
}
