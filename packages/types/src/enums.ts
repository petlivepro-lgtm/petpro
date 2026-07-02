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

// Tipos de campo do formulário de avaliação que o petshop monta nas configurações.
// STARS: 1–5 estrelas; SCALE_10: nota de 0 a 10; TEXT: pergunta aberta.
export const FEEDBACK_FIELD_TYPES = ["STARS", "SCALE_10", "TEXT"] as const;
export type FeedbackFieldType = (typeof FEEDBACK_FIELD_TYPES)[number];

export const FEEDBACK_FIELD_TYPE_LABEL: Record<FeedbackFieldType, string> = {
  STARS: "Estrelas",
  SCALE_10: "Nota de 0 a 10",
  TEXT: "Pergunta de texto",
};

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

// Categorias de produto (campo de texto livre no banco; valores predefinidos para a UI).
// O slug é salvo no banco; o rótulo é exibido no CRM e no app do tutor.
export const PRODUCT_CATEGORIES = [
  "racao",
  "petisco",
  "brinquedo",
  "higiene",
  "medicamento",
  "acessorio",
  "outro",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  racao: "Ração",
  petisco: "Petisco",
  brinquedo: "Brinquedo",
  higiene: "Higiene",
  medicamento: "Medicamento",
  acessorio: "Acessório",
  outro: "Outro",
};

// Lançamentos financeiros (supabase/migrations/0012_finance_stock.sql)
export const FINANCE_ENTRY_TYPES = ["INCOME", "EXPENSE"] as const;
export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPES)[number];

export const FINANCE_ENTRY_TYPE_LABEL: Record<FinanceEntryType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

export const FINANCE_SOURCES = ["MANUAL", "APPOINTMENT", "RESERVATION"] as const;
export type FinanceSource = (typeof FINANCE_SOURCES)[number];

// Categorias de lançamento (campo de texto livre no banco; valores predefinidos para a UI).
export const FINANCE_CATEGORIES = [
  "servico",
  "produto",
  "salario",
  "aluguel",
  "insumo",
  "outro",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  servico: "Serviço",
  produto: "Produto",
  salario: "Salário",
  aluguel: "Aluguel",
  insumo: "Insumo",
  outro: "Outro",
};

export const STOCK_MOVEMENT_TYPES = ["IN", "OUT"] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_MOVEMENT_TYPE_LABEL: Record<StockMovementType, string> = {
  IN: "Entrada",
  OUT: "Saída",
};

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
