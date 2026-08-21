import { z } from "zod";
import {
  CLUBINHO_CYCLES,
  CLUBINHO_SUBSCRIPTION_STATUSES,
  PAYMENT_METHODS,
  type ClubinhoCycle,
  type ClubinhoSubscriptionStatus,
  type PaymentMethod,
} from "./enums";

// DTOs e validações do Clubinho (supabase/migrations/0047_clubinho_plans.sql).
//
// Vocabulário: o *plano* é o pacote que o petshop monta; a *assinatura* liga
// um pet a um plano; o *ciclo* é cada renovação faturada; o *crédito* é o
// saldo de um serviço dentro do ciclo.

// --- Planos --------------------------------------------------------------

export type ClubinhoPlanItemDTO = {
  service_type_id: string;
  service_name: string;
  quantity: number;
};

export type ClubinhoPlanDTO = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  cycle: ClubinhoCycle;
  cycle_days: number | null;
  rollover: boolean;
  active: boolean;
  position: number;
  items: ClubinhoPlanItemDTO[];
  /** Assinaturas ainda abertas neste plano — barra a exclusão na UI. */
  subscriber_count: number;
};

const planItemInput = z.object({
  service_type_id: z.string().uuid("Serviço inválido"),
  quantity: z.coerce
    .number()
    .int("Quantidade inválida")
    .min(1, "A quantidade mínima é 1")
    .max(99, "A quantidade máxima é 99"),
});

export const clubinhoPlanInput = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, "Informe o nome do plano")
      .max(80, "Nome muito longo"),
    description: z.string().trim().max(500, "Descrição muito longa").optional(),
    price_cents: z.coerce
      .number()
      .int()
      .min(0, "Valor inválido")
      .default(0),
    cycle: z.enum(CLUBINHO_CYCLES),
    cycle_days: z.coerce
      .number()
      .int()
      .min(1, "Mínimo de 1 dia")
      .max(365, "Máximo de 365 dias")
      .optional(),
    rollover: z.boolean().optional().default(false),
    active: z.boolean().optional().default(true),
    // Um plano sem serviço não entrega nada — seria só uma cobrança.
    items: z
      .array(planItemInput)
      .min(1, "Escolha ao menos um serviço para o plano"),
  })
  .refine((v) => v.cycle !== "CUSTOM" || v.cycle_days !== undefined, {
    message: "Informe de quantos em quantos dias o plano renova",
    path: ["cycle_days"],
  })
  .refine(
    (v) =>
      new Set(v.items.map((i) => i.service_type_id)).size === v.items.length,
    { message: "O mesmo serviço foi adicionado duas vezes", path: ["items"] },
  );
export type ClubinhoPlanInput = z.infer<typeof clubinhoPlanInput>;

// --- Assinaturas ---------------------------------------------------------

/** Saldo de um serviço dentro do ciclo corrente. */
export type ClubinhoCreditDTO = {
  credit_id: string;
  service_type_id: string | null;
  service_name: string;
  quantity_total: number;
  quantity_used: number;
  quantity_left: number;
};

/** Uma linha de clubinho_subscription_view. */
export type ClubinhoSubscriptionDTO = {
  id: string;
  pet_id: string;
  tutor_id: string;
  plan_id: string;
  status: ClubinhoSubscriptionStatus;
  price_cents: number;
  started_on: string;
  period_start: string;
  period_end: string;
  auto_renew: boolean;
  payment_method: PaymentMethod | null;
  terminal_id: string | null;
  installments: number;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  plan_name: string;
  plan_cycle: ClubinhoCycle;
  plan_cycle_days: number | null;
  plan_rollover: boolean;
  plan_price_cents: number;
  plan_active: boolean;
  pet_name: string;
  pet_photo_path: string | null;
  pet_species: string | null;
  tutor_name: string;
  tutor_phone: string | null;
  /** Nulo quando o ciclo venceu e a renovação ainda não rodou. */
  period_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  credits: ClubinhoCreditDTO[];
  credits_total: number;
  credits_used: number;
  credits_left: number;
};

export const clubinhoSubscriptionInput = z.object({
  pet_id: z.string().uuid("Escolha o pet"),
  plan_id: z.string().uuid("Escolha o plano"),
  // Copiado do plano no formulário, mas editável: o balcão negocia.
  price_cents: z.coerce.number().int().min(0, "Valor inválido").default(0),
  started_on: z.string().min(1, "Informe a data de início"),
  auto_renew: z.boolean().optional().default(true),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  terminal_id: z.string().uuid().optional(),
  installments: z.coerce.number().int().min(1).max(24).optional().default(1),
  notes: z.string().trim().max(500, "Observação muito longa").optional(),
});
export type ClubinhoSubscriptionInput = z.infer<
  typeof clubinhoSubscriptionInput
>;

export const clubinhoSubscriptionUpdateInput = z.object({
  id: z.string().uuid(),
  price_cents: z.coerce.number().int().min(0, "Valor inválido").default(0),
  auto_renew: z.boolean().optional().default(true),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  terminal_id: z.string().uuid().optional(),
  installments: z.coerce.number().int().min(1).max(24).optional().default(1),
  notes: z.string().trim().max(500, "Observação muito longa").optional(),
  status: z.enum(CLUBINHO_SUBSCRIPTION_STATUSES).optional(),
  cancellation_reason: z
    .string()
    .trim()
    .max(500, "Motivo muito longo")
    .optional(),
});
export type ClubinhoSubscriptionUpdateInput = z.infer<
  typeof clubinhoSubscriptionUpdateInput
>;

// --- Ajudantes de leitura ------------------------------------------------

/**
 * Saldo do serviço no ciclo corrente, ou null quando o plano não cobre esse
 * serviço. É o que decide se o atendimento pode ser coberto pelo Clubinho.
 */
export function creditForService(
  subscription: ClubinhoSubscriptionDTO | null | undefined,
  serviceTypeId: string | null | undefined,
): ClubinhoCreditDTO | null {
  if (!subscription || !serviceTypeId) return null;
  if (subscription.status !== "ACTIVE") return null;
  return (
    subscription.credits.find((c) => c.service_type_id === serviceTypeId) ??
    null
  );
}

/** Resumo curto do saldo para chips e selos: "3 de 4 banhos". */
export function formatCreditSummary(credit: ClubinhoCreditDTO): string {
  return `${credit.quantity_left} de ${credit.quantity_total} ${credit.service_name.toLowerCase()}`;
}

/** Dias que faltam para o ciclo virar (negativo = já venceu). */
export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const end = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
}
