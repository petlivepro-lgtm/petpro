"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Home, MapPin, Store, Truck } from "lucide-react";
import { Avatar, Button, Card, EmptyState, StatusChip, cn } from "@mylivepet/ui";
import { DELIVERY_STOP_KIND_LABEL } from "@mylivepet/types";
import { useParadasDoDia } from "@/lib/use-paradas-do-dia";
import {
  agruparParadas,
  devolucaoLiberada,
  horaSP,
  horarioDaParada,
  paradaAtual,
  paradaEncerrada,
  type ParadaRow,
  type RotaDoDia,
} from "@/lib/rotas";

type Tom = "neutral" | "brand" | "success" | "danger" | "info" | "warning";

/** O que a parada está esperando, em palavras — mais útil que o status cru. */
function situacao(p: ParadaRow): { texto: string; tom: Tom; ponto: string } {
  switch (p.status) {
    case "EN_ROUTE":
      return { texto: "A caminho", tom: "brand", ponto: "bg-orange" };
    case "PICKED_UP":
      return { texto: "Com você", tom: "info", ponto: "bg-petrol" };
    case "DONE":
      return {
        texto: p.kind === "PICKUP" ? "No petshop" : "Entregue",
        tom: "success",
        ponto: "bg-success",
      };
    case "FAILED":
      return { texto: "Não realizada", tom: "danger", ponto: "bg-danger" };
    default:
      if (p.kind === "PICKUP") {
        return { texto: "Aguardando", tom: "neutral", ponto: "bg-gray-neutral/40" };
      }
      return devolucaoLiberada(p)
        ? { texto: "Pronto p/ entregar", tom: "success", ponto: "bg-success" }
        : { texto: "Em atendimento", tom: "warning", ponto: "bg-warning" };
  }
}

/**
 * O resumo do dia do entregador, na raiz: quanto falta, qual é a próxima e a
 * agenda com o horário de cada pet. Só leitura — iniciar a rota, GPS e
 * registrar parada ficam em /rota, a tela de trabalho.
 *
 * Client só pelo Realtime: a parada concluída em /rota (ou outro aparelho)
 * aparece aqui sem recarregar.
 */
export function EntregadorResumo({
  rota,
  dia,
  sidebar,
}: {
  rota: RotaDoDia;
  dia: string;
  sidebar: React.ReactNode;
}) {
  const { paradas } = useParadasDoDia(rota, dia, "resumo-entregador");
  const agora = useAgora();

  const atual = useMemo(() => paradaAtual(paradas), [paradas]);
  const g = useMemo(() => agruparParadas(paradas), [paradas]);
  const total = paradas.length;
  const feitas = paradas.filter((p) => p.status === "DONE").length;
  const encerradas = paradas.filter(paradaEncerrada).length;
  const aFazer = total - encerradas;
  const progresso = total ? Math.round((encerradas / total) * 100) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4 sm:space-y-6">
        <Card className="p-4 sm:p-5">
          <div className="grid grid-cols-3 divide-x divide-graphite/5">
            <Numero label="Paradas" valor={total} dica="no dia" />
            <Numero label="A fazer" valor={aFazer} dica="ainda faltam" cor="text-orange" />
            <Numero label="Concluídas" valor={feitas} dica="feitas" cor="text-success" />
          </div>
          {total > 0 && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-success transition-[width] duration-500"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-neutral">
                {encerradas} de {total} paradas · {progresso}%
              </p>
            </div>
          )}
        </Card>

        {total === 0 ? (
          <Card>
            <EmptyState
              icon={<Truck className="h-6 w-6" />}
              title="Nenhuma parada para hoje"
              description="Quando o petshop marcar um atendimento para buscar ou devolver em casa, ele aparece aqui."
            />
          </Card>
        ) : (
          <>
            {(g.comVoce.length > 0 || g.prontasParaEntregar.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {g.comVoce.length > 0 && (
                  <Aviso
                    icone={<Store className="h-5 w-5" />}
                    cor="bg-petrol/10 text-petrol"
                    texto={`${g.comVoce.length} ${g.comVoce.length === 1 ? "pet" : "pets"} com você, a caminho do petshop`}
                  />
                )}
                {g.prontasParaEntregar.length > 0 && (
                  <Aviso
                    icone={<Home className="h-5 w-5" />}
                    cor="bg-success/10 text-success"
                    texto={`${g.prontasParaEntregar.length} ${g.prontasParaEntregar.length === 1 ? "pet pronto" : "pets prontos"} para entregar`}
                  />
                )}
              </div>
            )}

            {atual ? (
              <ProximaParada parada={atual} agora={agora} />
            ) : (
              <Card className="flex items-center gap-3 bg-success/5 ring-1 ring-success/20">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Truck className="h-5 w-5" />
                </span>
                <p className="text-sm text-graphite">
                  Todas as paradas de hoje foram feitas. Bom trabalho!
                </p>
              </Card>
            )}

            <Card className="p-4 sm:p-5">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h2 className="font-heading text-base font-semibold text-graphite">
                  Agenda do dia
                </h2>
                <span className="text-xs text-gray-neutral">na ordem do dia</span>
              </div>
              <ol className="relative">
                {paradas.map((p, i) => (
                  <ItemAgenda
                    key={p.id}
                    parada={p}
                    daVez={atual?.id === p.id}
                    ultimo={i === paradas.length - 1}
                  />
                ))}
              </ol>
            </Card>
          </>
        )}
      </div>

      <div className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">{sidebar}</div>
    </div>
  );
}

/**
 * Relógio para as contagens ("em 40 min"). Começa nulo e só liga no navegador:
 * calcular no servidor daria um texto diferente do da hidratação.
 */
function useAgora(): number | null {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    setAgora(Date.now());
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  return agora;
}

/** "em 40 min", "em 1h05", "atrasada 10 min" — ou nada, se não há como saber. */
function contagem(iso: string | null, agora: number | null) {
  if (!iso || agora === null) return null;
  const min = Math.round((new Date(iso).getTime() - agora) / 60_000);
  if (min < -1) return { texto: `atrasada ${formatarMin(-min)}`, atrasada: true };
  if (min <= 1) return { texto: "agora", atrasada: false };
  return { texto: `em ${formatarMin(min)}`, atrasada: false };
}

function formatarMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function Numero({
  label,
  valor,
  dica,
  cor = "text-graphite",
}: {
  label: string;
  valor: number;
  dica: string;
  cor?: string;
}) {
  return (
    <div className="min-w-0 px-2 text-center first:pl-0 last:pr-0 sm:px-4 sm:text-left">
      <p className="truncate text-xs font-medium text-gray-neutral sm:text-sm">{label}</p>
      <p className={cn("mt-1 font-heading text-2xl font-bold tabular-nums sm:text-3xl", cor)}>
        {valor}
      </p>
      <p className="hidden text-xs text-gray-neutral sm:block">{dica}</p>
    </div>
  );
}

/** Um lembrete curto do que está pendente com ele, que leva para a rota. */
function Aviso({ icone, cor, texto }: { icone: React.ReactNode; cor: string; texto: string }) {
  return (
    <Link href="/rota">
      <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-muted/60">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cor)}>
          {icone}
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-graphite">{texto}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-gray-neutral" />
      </Card>
    </Link>
  );
}

function ProximaParada({ parada, agora }: { parada: ParadaRow; agora: number | null }) {
  const hora = horaSP(parada.etaAt);
  const atendimento = horaSP(parada.scheduledAt);
  // Só a busca tem prazo: a hora de buscar vem antes do atendimento. Na
  // devolução liberada o pet já está pronto — "atrasada" não diria nada.
  const falta = parada.kind === "PICKUP" ? contagem(parada.etaAt, agora) : null;

  return (
    <Card className="bg-orange/5 ring-1 ring-orange/30">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-orange">
        {parada.status === "EN_ROUTE"
          ? "A caminho"
          : parada.kind === "DROPOFF"
            ? "Pronto para entregar"
            : "Próxima busca"}
      </p>
      <div className="flex items-start gap-3 sm:gap-4">
        <Avatar name={parada.petName} src={parada.petPhoto} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="font-heading text-lg font-semibold text-graphite">
            {DELIVERY_STOP_KIND_LABEL[parada.kind]} {parada.petName}
          </p>
          <p className="truncate text-sm text-gray-neutral">
            {parada.tutorName}
            {parada.serviceName ? ` · ${parada.serviceName}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {hora && (
              <span className="flex items-center gap-1.5 text-graphite">
                <Clock className="h-3.5 w-3.5 text-gray-neutral" />
                {parada.kind === "PICKUP" ? "Buscar às " : "Pronto desde "}
                <span className="font-medium tabular-nums">{hora}</span>
                {falta && (
                  <span className={falta.atrasada ? "text-danger" : "text-gray-neutral"}>
                    · {falta.texto}
                  </span>
                )}
              </span>
            )}
            {parada.kind === "PICKUP" && atendimento && (
              <span className="text-gray-neutral">atendimento {atendimento}</span>
            )}
            {(parada.bairro ?? parada.endereco) && (
              <span className="flex min-w-0 items-center gap-1.5 text-gray-neutral">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{parada.bairro ?? parada.endereco}</span>
              </span>
            )}
          </div>
        </div>
      </div>
      <Link href="/rota" className="mt-4 block sm:inline-block">
        <Button className="w-full sm:w-auto">
          Ir para a rota
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </Card>
  );
}

function ItemAgenda({
  parada,
  daVez,
  ultimo,
}: {
  parada: ParadaRow;
  daVez: boolean;
  ultimo: boolean;
}) {
  const { hora, legenda } = horarioDaParada(parada);
  const encerrada = paradaEncerrada(parada);
  const sit = situacao(parada);

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0 sm:gap-4">
      <span className="w-12 shrink-0 pt-1.5 text-right">
        <span className="block text-sm font-medium tabular-nums text-graphite">
          {hora ?? "—"}
        </span>
        {legenda && (
          <span className="block text-[10px] leading-tight text-gray-neutral">{legenda}</span>
        )}
      </span>

      {/* Trilho da linha do tempo: bolinha no horário, traço até a próxima. */}
      <span className="relative flex w-3 shrink-0 justify-center">
        <span
          className={cn(
            "relative z-10 mt-3 h-3 w-3 rounded-full ring-4 ring-surface",
            parada.status === "DONE"
              ? "bg-success"
              : parada.status === "FAILED"
                ? "bg-danger"
                : daVez
                  ? "bg-orange"
                  : "bg-petrol/30",
          )}
        />
        {!ultimo && (
          <span className="absolute bottom-[-1rem] top-3 w-px bg-graphite/10" aria-hidden />
        )}
      </span>

      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2",
          daVez ? "bg-orange/5" : "bg-surface-muted/50",
          encerrada && "opacity-60",
        )}
      >
        <Avatar name={parada.petName} src={parada.petPhoto} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-graphite">
            {DELIVERY_STOP_KIND_LABEL[parada.kind]} · {parada.petName}
          </p>
          <p className="truncate text-xs text-gray-neutral">
            {[parada.tutorName, parada.bairro].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <StatusChip tone={sit.tom} className="hidden shrink-0 sm:inline-flex">
          {sit.texto}
        </StatusChip>
        <span
          className={cn("h-2 w-2 shrink-0 rounded-full sm:hidden", sit.ponto)}
          aria-label={sit.texto}
        />
      </div>
    </li>
  );
}
