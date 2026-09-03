// Enums espelhando os tipos do Postgres (supabase/migrations/0001_init.sql).
// COLLABORATOR (0030) é o profissional que atende: enxerga só a própria
// agenda e os pets que atende, nunca a gestão do petshop.
export const STAFF_ROLES = [
  "OWNER",
  "MANAGER",
  "ATTENDANT",
  "VIEWER",
  "COLLABORATOR",
] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Papéis com acesso ao painel de gestão (tudo menos o colaborador). */
export const MANAGEMENT_ROLES = [
  "OWNER",
  "MANAGER",
  "ATTENDANT",
  "VIEWER",
] as const satisfies readonly StaffRole[];

/** Papéis que podem escrever na gestão — VIEWER lê, COLLABORATOR nem vê. */
export const MUTATING_ROLES = [
  "OWNER",
  "MANAGER",
  "ATTENDANT",
] as const satisfies readonly StaffRole[];

export function canMutateAsRole(role: StaffRole): boolean {
  return (MUTATING_ROLES as readonly StaffRole[]).includes(role);
}

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  OWNER: "Dono",
  MANAGER: "Gerente",
  ATTENDANT: "Atendente",
  VIEWER: "Visualização",
  COLLABORATOR: "Colaborador",
};

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

export const FEEDBACK_DIRECTIONS = [
  "STAFF_TO_TUTOR",
  "TUTOR_TO_PETSHOP",
] as const;
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
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "EXPIRED",
  "CANCELLED",
  // REJECTED = recusada pelo petshop (com motivo); CANCELLED = cancelada pelo tutor.
  "REJECTED",
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const RESERVATION_ORIGINS = ["TUTOR", "STAFF"] as const;
export type ReservationOrigin = (typeof RESERVATION_ORIGINS)[number];

export const PAYMENT_METHODS = [
  "CASH",
  "PIX",
  "DEBIT_CARD",
  "CREDIT_CARD",
  "BANK_TRANSFER",
  "OTHER",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT_CARD: "Débito",
  CREDIT_CARD: "Crédito",
  BANK_TRANSFER: "Transferência",
  OTHER: "Outro",
};

// --- Maquininhas (supabase/migrations/0036_payment_terminal_fees.sql) ---

/**
 * Formas que passam pela maquininha. Só elas herdam a maquininha padrão quando
 * a venda não escolhe uma — espelha payment_method_uses_terminal no banco.
 */
export const TERMINAL_PAYMENT_METHODS = [
  "DEBIT_CARD",
  "CREDIT_CARD",
  "PIX",
] as const satisfies readonly PaymentMethod[];

export function usesPaymentTerminal(method: PaymentMethod): boolean {
  return (TERMINAL_PAYMENT_METHODS as readonly PaymentMethod[]).includes(
    method,
  );
}

/** Só o crédito parcela — as demais formas são sempre 1x. */
export function supportsInstallments(method: PaymentMethod): boolean {
  return method === "CREDIT_CARD";
}

/** Teto de parcelas oferecido na venda (o banco aceita até 24). */
export const MAX_INSTALLMENTS = 12;

// Opções de espécie de pet (campo de texto livre no banco; centralizado para a UI).
export const SPECIES_OPTIONS = ["Cão", "Gato"] as const;

// --- Porte do pet ---
// pet.size é texto livre no banco (0001); a lista canônica vive aqui e é o que
// petInput valida. Os rótulos são curtos de propósito: o campo já se chama
// "Porte", então "Porte grande" dentro dele seria redundante.
export const PET_SIZES = [
  "mini",
  "pequeno",
  "medio",
  "grande",
  "gigante",
] as const;
export type PetSize = (typeof PET_SIZES)[number];

export const PET_SIZE_LABEL: Record<PetSize, string> = {
  mini: "Mini",
  pequeno: "Pequeno",
  medio: "Médio",
  grande: "Grande",
  gigante: "Gigante",
};

/** Rótulo de um porte vindo do banco, que é texto livre e pode estar vazio. */
export function petSizeLabel(size?: string | null): string | null {
  if (!size) return null;
  return PET_SIZE_LABEL[size as PetSize] ?? size;
}

// --- Preço por porte (supabase/migrations/0058_service_size_price.sql) ---

/**
 * Preços opcionais por porte de serviço e de adicional. Coluna nula = aquele
 * porte não tem preço próprio e usa o `price_cents` base — é o que mantém de pé
 * todo serviço cadastrado antes de 0058.
 */
export type SizePrices = {
  price_mini_cents: number | null;
  price_pequeno_cents: number | null;
  price_medio_cents: number | null;
  price_grande_cents: number | null;
  price_gigante_cents: number | null;
};

const SIZE_PRICE_COLUMN: Record<PetSize, keyof SizePrices> = {
  mini: "price_mini_cents",
  pequeno: "price_pequeno_cents",
  medio: "price_medio_cents",
  grande: "price_grande_cents",
  gigante: "price_gigante_cents",
};

export type PricedBySize = SizePrices & { price_cents: number };

/**
 * Quanto custa o serviço para um pet daquele porte. Gêmeo em TypeScript de
 * price_for_pet_size() no banco (0058): a UI mostra o valor com esta função e o
 * caixa cobra com a do Postgres — as duas precisam concordar sempre.
 *
 * Pet sem porte, porte fora da lista ou porte sem preço próprio: preço base.
 */
export function priceForPetSize(
  row: PricedBySize,
  size?: string | null,
): number {
  const column = size ? SIZE_PRICE_COLUMN[size as PetSize] : undefined;
  const price = column ? row[column] : null;
  return price ?? row.price_cents;
}

/** Tem ao menos um porte com preço próprio (o catálogo mostra faixa, não valor). */
export function hasSizePrices(row: SizePrices): boolean {
  return PET_SIZES.some((s) => row[SIZE_PRICE_COLUMN[s]] != null);
}

/** Menor e maior preço praticados: o base e os portes preenchidos. */
export function petSizePriceRange(row: PricedBySize): {
  min: number;
  max: number;
} {
  const prices = [
    row.price_cents,
    ...PET_SIZES.map((s) => row[SIZE_PRICE_COLUMN[s]]).filter(
      (v): v is number => v != null,
    ),
  ];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// Categorias de produto (campo de texto livre no banco; valores predefinidos para a UI).
// O slug é salvo no banco; o rótulo é exibido no CRM e no app do tutor.
export const PRODUCT_CATEGORIES = [
  "racao",
  "petisco",
  "brinquedo",
  "higiene",
  "medicamento",
  "acessorio",
  "limpeza",
  "insumo",
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
  limpeza: "Limpeza",
  insumo: "Insumo",
  outro: "Outro",
};

// --- Variações de produto (supabase/migrations/0020_product_variants.sql) ---
// Cada variação é um SKU: cor + tamanho + peso, com preço e estoque próprios.
// Qualquer um dos três atributos pode faltar.

// Paleta de cores do cadastro. O nome é o que fica salvo e aparece ao lado do
// círculo; o hex é só a amostra visual.
export const PRODUCT_COLORS = [
  { name: "Preto", hex: "#1F2937" },
  { name: "Branco", hex: "#FFFFFF" },
  { name: "Cinza", hex: "#9CA3AF" },
  { name: "Bege", hex: "#E7D8B8" },
  { name: "Marrom", hex: "#8B5E3C" },
  { name: "Vermelho", hex: "#DC2626" },
  { name: "Rosa", hex: "#F472B6" },
  { name: "Laranja", hex: "#F97316" },
  { name: "Amarelo", hex: "#FACC15" },
  { name: "Verde", hex: "#16A34A" },
  { name: "Azul", hex: "#2563EB" },
  { name: "Roxo", hex: "#7C3AED" },
  // Estampado/multicolor: o swatch é desenhado em degradê pela UI.
  { name: "Colorido", hex: "#A3A3A3" },
] as const;
export type ProductColor = (typeof PRODUCT_COLORS)[number];

export const PRODUCT_COLOR_HEX: Record<string, string> = Object.fromEntries(
  PRODUCT_COLORS.map((c) => [c.name, c.hex]),
);

export const WEIGHT_UNITS = ["g", "kg"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const WEIGHT_UNIT_LABEL: Record<WeightUnit, string> = {
  g: "gramas (g)",
  kg: "quilogramas (kg)",
};

// Lançamentos financeiros (supabase/migrations/0012_finance_stock.sql)
export const FINANCE_ENTRY_TYPES = ["INCOME", "EXPENSE"] as const;
export type FinanceEntryType = (typeof FINANCE_ENTRY_TYPES)[number];

export const FINANCE_ENTRY_TYPE_LABEL: Record<FinanceEntryType, string> = {
  INCOME: "Receita",
  EXPENSE: "Despesa",
};

export const FINANCE_SOURCES = [
  "MANUAL",
  "APPOINTMENT",
  "RESERVATION",
  "REFUND",
  "CLUBINHO",
] as const;
export type FinanceSource = (typeof FINANCE_SOURCES)[number];

export const FINANCE_MOVEMENT_KINDS = ["INCOME", "EXPENSE", "REFUND"] as const;
export type FinanceMovementKind = (typeof FINANCE_MOVEMENT_KINDS)[number];

export const FINANCE_MOVEMENT_KIND_LABEL: Record<FinanceMovementKind, string> =
  {
    INCOME: "Receita",
    EXPENSE: "Despesa",
    REFUND: "Estorno",
  };

export const FINANCE_ORIGINS = [
  "SERVICE",
  "PRODUCT",
  "CLUBINHO",
  "MANUAL",
] as const;
export type FinanceOrigin = (typeof FINANCE_ORIGINS)[number];

export const FINANCE_ORIGIN_LABEL: Record<FinanceOrigin, string> = {
  SERVICE: "Serviço",
  PRODUCT: "Produto",
  CLUBINHO: "Clubinho",
  MANUAL: "Manual",
};

// Categorias de lançamento (campo de texto livre no banco; valores predefinidos para a UI).
export const FINANCE_CATEGORIES = [
  "servico",
  "produto",
  "clubinho",
  "salario",
  "aluguel",
  "insumo",
  "outro",
] as const;
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];

export const FINANCE_CATEGORY_LABEL: Record<FinanceCategory, string> = {
  servico: "Serviço",
  produto: "Produto",
  clubinho: "Clubinho",
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

export const STOCK_MOVEMENT_SOURCES = [
  "MANUAL",
  "RESERVATION",
  "SALE",
  "CANCELLATION",
  "EXPIRATION",
  "REFUND",
] as const;
export type StockMovementSource = (typeof STOCK_MOVEMENT_SOURCES)[number];

export const STOCK_MOVEMENT_SOURCE_LABEL: Record<StockMovementSource, string> =
  {
    MANUAL: "Manual",
    RESERVATION: "Reserva",
    SALE: "Venda",
    CANCELLATION: "Cancelamento",
    EXPIRATION: "Expiração",
    REFUND: "Devolução",
  };

// Status que ocupam o horário do colaborador (bloqueiam o slot na agenda).
// REJECTED/CANCELLED liberam o horário (ver 0014_collaborators.sql).
export const BUSY_APPOINTMENT_STATUSES = [
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
] as const satisfies readonly AppointmentStatus[];

// Dias da semana na convenção de Date.getDay(): 0=domingo .. 6=sábado
// (mesma usada em collaborator_schedule.weekday).
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  0: "Domingo",
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
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
  PARTIALLY_REFUNDED: "Parcialmente devolvido",
  REFUNDED: "Devolvido",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REJECTED: "Recusado",
};

// --- Clubinho (supabase/migrations/0047_clubinho_plans.sql) ---

/**
 * Intervalo em que a mensalidade é cobrada e os créditos voltam a encher.
 * Não é a frequência das idas ao banho: o "plano quinzenal" que o petshop
 * vende (banho a cada 15 dias) é um plano MENSAL com 2 banhos.
 */
export const CLUBINHO_CYCLES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
  "CUSTOM",
] as const;
export type ClubinhoCycle = (typeof CLUBINHO_CYCLES)[number];

export const CLUBINHO_CYCLE_LABEL: Record<ClubinhoCycle, string> = {
  WEEKLY: "Semanal",
  BIWEEKLY: "Quinzenal",
  MONTHLY: "Mensal",
  BIMONTHLY: "Bimestral",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  CUSTOM: "Personalizado",
};

/** Como o ciclo aparece na frase "renova a cada ...". */
export const CLUBINHO_CYCLE_EVERY: Record<ClubinhoCycle, string> = {
  WEEKLY: "7 dias",
  BIWEEKLY: "15 dias",
  MONTHLY: "mês",
  BIMONTHLY: "2 meses",
  QUARTERLY: "3 meses",
  SEMIANNUAL: "6 meses",
  ANNUAL: "ano",
  CUSTOM: "período",
};

export const CLUBINHO_SUBSCRIPTION_STATUSES = [
  "ACTIVE",
  "PAUSED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type ClubinhoSubscriptionStatus =
  (typeof CLUBINHO_SUBSCRIPTION_STATUSES)[number];

export const CLUBINHO_STATUS_LABEL: Record<ClubinhoSubscriptionStatus, string> =
  {
    ACTIVE: "Ativa",
    PAUSED: "Pausada",
    CANCELLED: "Cancelada",
    EXPIRED: "Encerrada",
  };

/** Status que ainda ocupam a vaga única do pet (espelha o índice parcial). */
export const CLUBINHO_OPEN_STATUSES = [
  "ACTIVE",
  "PAUSED",
] as const satisfies readonly ClubinhoSubscriptionStatus[];

export function isClubinhoOpen(status: ClubinhoSubscriptionStatus): boolean {
  return (
    CLUBINHO_OPEN_STATUSES as readonly ClubinhoSubscriptionStatus[]
  ).includes(status);
}

/**
 * Rótulo do ciclo com os dias do personalizado ("Personalizado · 20 dias").
 * O `cycle_days` só é significativo em CUSTOM — nos demais o banco fixa o
 * intervalo em clubinho_cycle_interval.
 */
export function clubinhoCycleLabel(
  cycle: ClubinhoCycle,
  cycleDays?: number | null,
): string {
  if (cycle !== "CUSTOM") return CLUBINHO_CYCLE_LABEL[cycle];
  return cycleDays
    ? `Personalizado · ${cycleDays} dia${cycleDays > 1 ? "s" : ""}`
    : "Personalizado";
}
