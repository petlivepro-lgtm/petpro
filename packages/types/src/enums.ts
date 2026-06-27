// Enums espelhando os tipos do Postgres (supabase/migrations/0001_init.sql).
export const STAFF_ROLES = ["OWNER", "MANAGER", "ATTENDANT", "VIEWER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const APPOINTMENT_ORIGINS = ["STAFF", "TUTOR"] as const;
export type AppointmentOrigin = (typeof APPOINTMENT_ORIGINS)[number];

export const APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const FEEDBACK_DIRECTIONS = ["STAFF_TO_TUTOR", "TUTOR_TO_PETSHOP"] as const;
export type FeedbackDirection = (typeof FEEDBACK_DIRECTIONS)[number];

export const RESERVATION_STATUSES = [
  "RESERVED",
  "PICKED",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

// Opções de espécie de pet (campo de texto livre no banco; centralizado para a UI).
export const SPECIES_OPTIONS = ["Cão", "Gato"] as const;

// Rótulos em pt-BR para UI
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  REQUESTED: "Solicitado",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Check-in",
  IN_PROGRESS: "Em atendimento",
  COMPLETED: "Finalizado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
};

export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  RESERVED: "Reservado",
  PICKED: "Separado",
  COMPLETED: "Retirado/Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
};
