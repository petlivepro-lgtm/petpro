"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { AppointmentStatus, BehaviorCategory } from "@mylivepet/types";
import { StartAppointmentDialog, type CameraOption } from "@/components/start-appointment-dialog";
import { FinishAppointmentDialog } from "@/components/finish-appointment-dialog";

/**
 * Ações do atendimento direto na lista, reusando os mesmos dialogs da tela de
 * detalhe — o profissional inicia e finaliza sem sair da agenda do dia.
 */
export function AppointmentQuickActions({
  appointmentId,
  status,
  cameras,
  behaviorCategories,
  canConfirm = true,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  cameras: CameraOption[];
  behaviorCategories: BehaviorCategory[];
  /**
   * Confirmar solicitação é do balcão. O colaborador chega a ver atendimentos
   * REQUESTED (o tutor escolhe o profissional ao solicitar), mas /solicitacoes
   * é rota bloqueada para ele — o link viraria um beco sem saída.
   */
  canConfirm?: boolean;
}) {
  if (status === "CONFIRMED" || status === "CHECKED_IN") {
    return (
      <StartAppointmentDialog
        appointmentId={appointmentId}
        cameras={cameras}
        size="sm"
        className="whitespace-nowrap"
      />
    );
  }

  if (status === "IN_PROGRESS") {
    return (
      <FinishAppointmentDialog
        appointmentId={appointmentId}
        behaviorCategories={behaviorCategories}
        size="sm"
        className="whitespace-nowrap"
      />
    );
  }

  if (status === "REQUESTED") {
    if (!canConfirm) {
      return (
        <span className="whitespace-nowrap text-sm text-gray-neutral">
          Aguardando confirmação
        </span>
      );
    }
    return (
      <Link
        href="/solicitacoes"
        className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-orange hover:underline"
      >
        Confirmar <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  return null;
}
