import { z } from "zod";
import { APPOINTMENT_STATUSES, PRODUCT_CATEGORIES } from "./enums";

// DTOs de validação compartilhados entre os apps (formulários, server actions).

export const tutorInput = z.object({
  full_name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});
export type TutorInput = z.infer<typeof tutorInput>;

export const petInput = z.object({
  tutor_id: z.string().uuid(),
  name: z.string().min(1, "Informe o nome do pet"),
  species: z.string().optional(),
  breed: z.string().optional(),
  size: z.enum(["pequeno", "medio", "grande"]).optional(),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
});
export type PetInput = z.infer<typeof petInput>;

// Solicitação de agendamento feita pelo tutor no MyLivePet.
// Pode conter vários serviços — cada um vira um appointment compartilhando
// o mesmo request_group_id (ver migração 0008).
export const bookingRequest = z.object({
  pet_id: z.string().uuid(),
  service_type_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um serviço"),
  scheduled_at: z.string().min(1, "Escolha data e horário"),
  notes: z.string().optional(),
});
export type BookingRequest = z.infer<typeof bookingRequest>;

// Avaliação do tutor sobre o atendimento (TUTOR_TO_PETSHOP)
export const tutorFeedbackInput = z.object({
  appointment_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
export type TutorFeedbackInput = z.infer<typeof tutorFeedbackInput>;

// Relato de comportamento do staff (STAFF_TO_TUTOR)
export const behaviorFeedbackInput = z.object({
  appointment_id: z.string().uuid(),
  comment: z.string().min(1, "Descreva o comportamento do pet"),
});
export type BehaviorFeedbackInput = z.infer<typeof behaviorFeedbackInput>;

// Passo/observação registrado durante o atendimento
export const appointmentStepInput = z.object({
  appointment_id: z.string().uuid(),
  label: z.string().min(1, "Descreva o passo"),
});
export type AppointmentStepInput = z.infer<typeof appointmentStepInput>;

export const reservationItemInput = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const reservationInput = z.object({
  items: z.array(reservationItemInput).min(1, "Selecione ao menos um produto"),
  note: z.string().optional(),
});
export type ReservationInput = z.infer<typeof reservationInput>;

export const reservationItemCancel = z.object({
  item_id: z.string().uuid(),
});
export type ReservationItemCancel = z.infer<typeof reservationItemCancel>;

export const reservationCancel = z.object({
  reservation_id: z.string().uuid(),
});
export type ReservationCancel = z.infer<typeof reservationCancel>;

export const appointmentStatusUpdate = z.object({
  appointment_id: z.string().uuid(),
  status: z.enum(APPOINTMENT_STATUSES),
});

// Atualização em lote: confirmar/recusar vários serviços de uma solicitação.
export const appointmentStatusBatchUpdate = z.object({
  appointment_ids: z.array(z.string().uuid()).min(1),
  status: z.enum(APPOINTMENT_STATUSES),
});

// Autocadastro de petshop (cria tenant + dono OWNER no CRM)
export const petshopSignup = z.object({
  petshop_name: z.string().min(2, "Informe o nome do petshop"),
  full_name: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
  phone: z.string().optional(),
});
export type PetshopSignup = z.infer<typeof petshopSignup>;

// Serviço oferecido pelo petshop (cadastro/edição no CRM; some no app do tutor)
export const serviceTypeInput = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional(),
  price_cents: z.number().int().min(0),
  duration_min: z.number().int().positive("Informe a duração em minutos"),
  active: z.boolean().optional(),
  default_steps: z.array(z.string().min(1)).optional(),
});
export type ServiceTypeInput = z.infer<typeof serviceTypeInput>;

// Configurações do petshop (nome + dados de contato; logo sobe à parte)
export const tenantSettingsInput = z.object({
  name: z.string().min(2, "Informe o nome do petshop"),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  address: z.string().optional(),
});
export type TenantSettingsInput = z.infer<typeof tenantSettingsInput>;

// Produto do catálogo (cadastro/edição no CRM)
export const productInput = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional(),
  category: z.enum(PRODUCT_CATEGORIES, { message: "Selecione uma categoria" }),
  price_cents: z.number().int().min(0),
  stock: z.number().int().min(0),
  active: z.boolean().optional(),
});
export type ProductInput = z.infer<typeof productInput>;
