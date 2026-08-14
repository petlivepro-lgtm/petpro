"use client";

import Link from "next/link";
import { Avatar, StatusChip, cn } from "@mylivepet/ui";
import type {
  AppointmentStatus,
  BehaviorCategory,
  PaymentTerminalDTO,
} from "@mylivepet/types";
import { AppointmentStatusBadge } from "@/components/status-badge";
import { AppointmentQuickActions } from "@/components/appointment-quick-actions";
import type { CameraOption } from "@/components/start-appointment-dialog";
import { formatTime, type AtendimentoRow as Row } from "@/lib/atendimentos";

/** Cor da barra lateral por status — mesma leitura das badges. */
const accent: Record<AppointmentStatus, string> = {
  REQUESTED: "border-l-warning",
  CONFIRMED: "border-l-petrol",
  CHECKED_IN: "border-l-petrol",
  IN_PROGRESS: "border-l-orange",
  COMPLETED: "border-l-success",
  REJECTED: "border-l-danger",
  CANCELLED: "border-l-gray-neutral",
};

/**
 * Uma linha da agenda: hora em destaque, pet, serviço, profissional e ações.
 * Mesmo bloco no desktop e no mobile — as colunas secundárias somem em telas
 * estreitas em vez de existir um layout paralelo de cards.
 */
export function AtendimentoRow({
  row,
  cameras,
  behaviorCategories,
  terminals,
  canConfirm = true,
}: {
  row: Row;
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  terminals: PaymentTerminalDTO[];
  canConfirm?: boolean;
}) {
  const live = row.status === "IN_PROGRESS";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-graphite/5 border-l-4 bg-surface p-3 shadow-card transition-colors sm:gap-4 sm:p-4",
        accent[row.status],
        live && "bg-orange/5 ring-1 ring-orange/30",
      )}
    >
      <Link
        href={`/atendimentos/${row.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
      >
        <div className="w-12 shrink-0 text-center sm:w-14">
          <p
            className={cn(
              "font-heading text-lg font-semibold tabular-nums",
              live ? "text-orange" : "text-graphite",
            )}
          >
            {formatTime(row.scheduledAt)}
          </p>
        </div>

        <Avatar name={row.petName} src={row.petPhoto} size="sm" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-graphite">
            {row.petName}
            {row.tutorName && (
              <span className="font-normal text-gray-neutral">
                {" "}
                · {row.tutorName}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-gray-neutral">
            {row.serviceName}
            <span className="md:hidden">
              {row.collaboratorName
                ? ` · ${row.collaboratorName}`
                : " · sem profissional"}
            </span>
          </p>
        </div>

        <div className="hidden w-40 shrink-0 md:block">
          {row.collaboratorName ? (
            <span className="inline-flex items-center gap-2 text-sm text-gray-neutral">
              <Avatar
                name={row.collaboratorName}
                size="sm"
                className="h-7 w-7 text-[10px]"
              />
              <span className="truncate">{row.collaboratorName}</span>
            </span>
          ) : (
            <span className="text-sm text-gray-neutral">—</span>
          )}
        </div>

        <div className="hidden shrink-0 lg:block">
          <StatusChip tone={row.origin === "TUTOR" ? "brand" : "neutral"}>
            {row.origin === "TUTOR" ? "Tutor" : "Petshop"}
          </StatusChip>
        </div>

        <div className="hidden shrink-0 sm:block">
          <AppointmentStatusBadge status={row.status} />
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <span className="sm:hidden">
          <AppointmentStatusBadge status={row.status} />
        </span>
        <AppointmentQuickActions
          appointmentId={row.id}
          status={row.status}
          cameras={cameras}
          behaviorCategories={behaviorCategories}
          terminals={terminals}
          priceCents={row.servicePriceCents ?? undefined}
          canConfirm={canConfirm}
        />
      </div>
    </div>
  );
}
