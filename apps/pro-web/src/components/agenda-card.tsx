"use client";

import Link from "next/link";
import { Avatar, cn } from "@mylivepet/ui";
import { serviceColor, serviceInk } from "@/lib/agenda-colors";
import { formatTime, type AtendimentoRow as Row } from "@/lib/atendimentos";

/**
 * O card de um atendimento na grade: foto e nome do pet com o serviço em
 * destaque na cor cadastrada e, no rodapé, o profissional que faz o serviço.
 *
 * O tutor fica de fora de propósito: na célula estreita da grade ele empurrava
 * o profissional para baixo sem responder nada que quem olha a agenda precise
 * decidir na hora. Continua na busca e na ficha do atendimento.
 *
 * O card inteiro é o link para a ficha; as ações rápidas (iniciar, finalizar)
 * ficam lá dentro, porque na grade não há largura para elas sem esmagar o que
 * importa num relance.
 */
export function AgendaCard({ row }: { row: Row }) {
  const color = serviceColor(row.serviceId, row.serviceColorHex);
  // O fundo fica na cor escolhida; só o texto escurece quando precisa.
  const ink = serviceInk(row.serviceId, row.serviceColorHex);
  const live = row.status === "IN_PROGRESS";
  const done = row.status === "COMPLETED";
  const off = row.status === "CANCELLED" || row.status === "REJECTED";
  // A célula já diz a hora cheia; só o encaixe fora dela precisa do horário
  // escrito, senão um 09:15 vira "nove da manhã" e alguém perde o pet.
  const at = row.scheduledAt ? new Date(row.scheduledAt) : null;
  const offHour = at != null && at.getMinutes() !== 0;

  return (
    <Link
      href={`/atendimentos/${row.id}`}
      title={[
        formatTime(row.scheduledAt),
        row.petName,
        row.tutorName,
        row.serviceName,
      ]
        .filter(Boolean)
        .join(" · ")}
      className={cn(
        "block rounded-xl border border-graphite/10 bg-surface p-2 shadow-card transition-shadow hover:shadow-card-hover",
        live && "ring-2 ring-orange",
        off && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <Avatar
          name={row.petName}
          src={row.petPhoto}
          size="sm"
          className="h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-heading text-sm font-semibold text-graphite",
              off && "line-through",
            )}
          >
            {row.petName}
          </p>
          {offHour && (
            <p className="text-[11px] font-medium tabular-nums text-gray-neutral">
              {formatTime(row.scheduledAt)}
            </p>
          )}
          <span
            className="mt-0.5 inline-block max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight"
            style={{ background: `${color}1F`, color: ink }}
          >
            {row.serviceName}
          </span>
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        {row.collaboratorName ? (
          <>
            <Avatar
              name={row.collaboratorName}
              size="sm"
              className="h-5 w-5 text-[9px]"
            />
            <span className="min-w-0 flex-1 truncate text-xs text-gray-neutral">
              {row.collaboratorName}
            </span>
          </>
        ) : (
          <span className="text-xs italic text-gray-neutral">
            Sem profissional
          </span>
        )}
        {live && (
          <span className="shrink-0 text-[10px] font-semibold uppercase text-orange">
            Agora
          </span>
        )}
        {done && (
          <span className="shrink-0 text-[10px] font-semibold uppercase text-success">
            Feito
          </span>
        )}
      </div>
    </Link>
  );
}
