import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "@mylivepet/types";

/** Rótulos de status de agendamento para o app do tutor: REQUESTED aparece
 * como "Pendente" (aguardando confirmação do petshop), diferente do CRM,
 * onde "Solicitado" está alinhado com a fila de Solicitações da equipe. */
export const TUTOR_APPOINTMENT_STATUS_LABEL = {
  ...APPOINTMENT_STATUS_LABEL,
  REQUESTED: "Pendente",
};

/** Tom do Badge de cada status no app do tutor. */
export const TUTOR_APPOINTMENT_STATUS_TONE: Record<
  AppointmentStatus,
  "neutral" | "info" | "success" | "warning" | "danger"
> = {
  REQUESTED: "warning",
  CONFIRMED: "info",
  CHECKED_IN: "info",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};
