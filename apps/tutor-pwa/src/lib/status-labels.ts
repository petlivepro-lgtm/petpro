import { APPOINTMENT_STATUS_LABEL } from "@mylivepet/types";

/** Rótulos de status de agendamento para o app do tutor: REQUESTED aparece
 * como "Pendente" (aguardando confirmação do petshop), diferente do CRM,
 * onde "Solicitado" está alinhado com a fila de Solicitações da equipe. */
export const TUTOR_APPOINTMENT_STATUS_LABEL = {
  ...APPOINTMENT_STATUS_LABEL,
  REQUESTED: "Pendente",
};
