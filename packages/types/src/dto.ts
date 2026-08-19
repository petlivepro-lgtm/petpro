import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  FEEDBACK_FIELD_TYPES,
  FINANCE_ENTRY_TYPES,
  PAYMENT_METHODS,
  PRODUCT_CATEGORIES,
  STOCK_MOVEMENT_TYPES,
  WEIGHT_UNITS,
  type PaymentMethod,
} from "./enums";

// DTOs de validação compartilhados entre os apps (formulários, server actions).

export const tutorInput = z.object({
  full_name: z.string().min(2, "Informe o nome"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  cpf: z
    .string()
    .optional()
    .transform((value) => value?.replace(/\D/g, "") || undefined)
    .refine(
      (value) => !value || value.length === 11,
      "CPF deve ter 11 dígitos",
    ),
  notes: z.string().optional(),
  // Assinante do Clubinho (pacote de serviços pago). Chega da action já
  // convertido para booleano — o FormData de um checkbox devolve "on"/null.
  clubinho: z.boolean().optional().default(false),
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

// Agendamento de serviços, nas duas origens: solicitação feita pelo tutor no
// MyLivePet (origin TUTOR, nasce REQUESTED) e agendamento que o petshop cria em
// nome do tutor no Pet Live Pro (origin STAFF, nasce CONFIRMED).
// Pode conter vários serviços — cada um vira um appointment compartilhando
// o mesmo request_group_id (ver migração 0008).
export const bookingRequest = z.object({
  pet_id: z.string().uuid(),
  service_type_ids: z
    .array(z.string().uuid())
    .min(1, "Selecione ao menos um serviço"),
  collaborator_id: z.string().uuid("Escolha um profissional"),
  scheduled_at: z.string().min(1, "Escolha data e horário"),
  notes: z.string().optional(),
});
export type BookingRequest = z.infer<typeof bookingRequest>;

// --- Colaboradores (profissionais do petshop, sem login) ---
// Janela de trabalho semanal; weekday na convenção de Date.getDay() (0=domingo).
export const collaboratorScheduleInput = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
    end_time: z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido"),
  })
  .refine((s) => s.start_time < s.end_time, {
    message: "Horário final deve ser após o inicial",
  });
export type CollaboratorScheduleInput = z.infer<
  typeof collaboratorScheduleInput
>;

export const collaboratorInput = z.object({
  full_name: z.string().min(2, "Informe o nome"),
  role_title: z.string().optional(),
  active: z.boolean().optional(),
  schedules: z.array(collaboratorScheduleInput),
});
export type CollaboratorInput = z.infer<typeof collaboratorInput>;

// --- Formulário de avaliação configurável pelo petshop ---
// O petshop monta, nas configurações, uma lista de campos. Cada campo tem um
// tipo (estrelas / 0 a 10 / texto), uma pergunta (label) e se é obrigatório.
export const feedbackFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FEEDBACK_FIELD_TYPES),
  label: z.string().min(1, "Informe a pergunta"),
  required: z.boolean(),
});
export type FeedbackField = z.infer<typeof feedbackFieldSchema>;

export const feedbackConfigSchema = z.object({
  fields: z.array(feedbackFieldSchema).max(10, "No máximo 10 campos"),
});
export type FeedbackConfig = z.infer<typeof feedbackConfigSchema>;

// Resposta de um campo, com snapshot de tipo/label para preservar leitura
// histórica caso o petshop edite a configuração depois.
export const feedbackResponseSchema = z
  .object({
    field_id: z.string().min(1),
    type: z.enum(FEEDBACK_FIELD_TYPES),
    label: z.string().min(1),
    value: z.union([z.number(), z.string()]),
  })
  .superRefine((r, ctx) => {
    if (r.type === "TEXT") {
      if (typeof r.value !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Resposta inválida",
        });
      }
      return;
    }
    if (typeof r.value !== "number" || !Number.isInteger(r.value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Nota inválida" });
      return;
    }
    const max = r.type === "STARS" ? 5 : 10;
    const min = r.type === "STARS" ? 1 : 0;
    if (r.value < min || r.value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nota fora da faixa",
      });
    }
  });
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;

// Avaliação do tutor sobre o atendimento (TUTOR_TO_PETSHOP)
export const tutorFeedbackInput = z.object({
  appointment_id: z.string().uuid(),
  responses: z
    .array(feedbackResponseSchema)
    .min(1, "Responda ao menos um campo"),
});
export type TutorFeedbackInput = z.infer<typeof tutorFeedbackInput>;

// --- Boletim de comportamento do pet, configurável pelo petshop ---
// O petshop monta a lista de categorias que a equipe avalia ao finalizar cada
// atendimento (uma nota de 1 a 5 por categoria, tipo boletim escolar).
//
// `inverted`: nota alta é ruim (ex.: "Ansiedade", "Bagunça"). Na média a nota
// entra como 6 - valor, para que "média alta" signifique sempre "comportamento
// bom" — sem isso, um petshop que cadastra "Bagunça" passa a premiar o pior pet.
export const behaviorCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Informe a categoria"),
  inverted: z.boolean(),
  required: z.boolean(),
});
export type BehaviorCategory = z.infer<typeof behaviorCategorySchema>;

export const behaviorConfigSchema = z.object({
  categories: z.array(behaviorCategorySchema).max(8, "No máximo 8 categorias"),
});
export type BehaviorConfig = z.infer<typeof behaviorConfigSchema>;

// Nota de uma categoria, com snapshot de rótulo/inversão para o boletim antigo
// continuar legível se o petshop editar as categorias depois.
export const behaviorResponseSchema = z.object({
  category_id: z.string().min(1),
  label: z.string().min(1),
  inverted: z.boolean(),
  value: z.number().int().min(1, "Nota inválida").max(5, "Nota inválida"),
});
export type BehaviorResponse = z.infer<typeof behaviorResponseSchema>;

// Boletim registrado ao finalizar o atendimento (só o petshop escreve).
export const behaviorReportInput = z.object({
  appointment_id: z.string().uuid(),
  note: z.string().trim().max(1000, "Observação muito longa").optional(),
  responses: z.array(behaviorResponseSchema).max(8),
});
export type BehaviorReportInput = z.infer<typeof behaviorReportInput>;

// Passo/observação registrado durante o atendimento
export const appointmentStepInput = z.object({
  appointment_id: z.string().uuid(),
  label: z.string().min(1, "Descreva o passo"),
});
export type AppointmentStepInput = z.infer<typeof appointmentStepInput>;

export const reservationItemInput = z.object({
  product_id: z.string().uuid(),
  // Obrigatório quando o produto tem variações ativas (validado na RPC
  // reserve_products, que é quem enxerga o catálogo).
  variant_id: z.string().uuid().optional(),
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

// Recusa da reserva pelo petshop: o motivo é obrigatório e vai para o tutor.
export const reservationReject = z.object({
  reservation_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Escreva o motivo da recusa")
    .max(500, "Motivo muito longo (máx. 500 caracteres)"),
});
export type ReservationReject = z.infer<typeof reservationReject>;

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

// --- Biblioteca de etapas do atendimento (Configurações → Etapas) ---
// O petshop cadastra as etapas uma vez; cada serviço escolhe as suas por id
// (service_type.step_ids). Renomear aqui reflete em todos os serviços, mas não
// em atendimentos já iniciados: appointment_step guarda o rótulo como snapshot.
export const SERVICE_STEP_LIBRARY_MAX = 30;
export const SERVICE_STEP_LABEL_MAX = 60;

export const serviceStepTemplateSchema = z.object({
  // uuid porque vira a PK de service_step_template (crypto.randomUUID no form)
  id: z.string().uuid(),
  label: z
    .string()
    .trim()
    .min(1, "Informe o nome da etapa")
    .max(SERVICE_STEP_LABEL_MAX, "Nome muito longo (máx. 60 caracteres)"),
});
export type ServiceStepTemplate = z.infer<typeof serviceStepTemplateSchema>;

export const serviceStepLibrarySchema = z.object({
  // Ids que o formulário tinha em mãos ao carregar. A action só apaga o que
  // está aqui e não está em `steps`, então uma tela desatualizada (ou ainda
  // vazia, em pleno carregamento) nunca derruba a biblioteca de outra pessoa.
  known_ids: z.array(z.string().uuid()),
  steps: z
    .array(serviceStepTemplateSchema)
    .max(
      SERVICE_STEP_LIBRARY_MAX,
      `No máximo ${SERVICE_STEP_LIBRARY_MAX} etapas`,
    )
    // Espelha o índice único (tenant_id, lower(btrim(label))) da 0035, para o
    // erro chegar com o nome da etapa em vez do texto cru do Postgres.
    .superRefine((steps, ctx) => {
      const seen = new Set<string>();
      for (const s of steps) {
        const norm = s.label.trim().toLowerCase();
        if (seen.has(norm)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A etapa “${s.label}” está repetida`,
          });
          return;
        }
        seen.add(norm);
      }
    }),
});
export type ServiceStepLibrary = z.infer<typeof serviceStepLibrarySchema>;

// Só os rótulos: o id é gerado no form, porque precisa ser uuid válido para
// virar PK (diferente de DEFAULT_BEHAVIOR_CATEGORIES, que já vem com id fixo).
export const DEFAULT_SERVICE_STEP_LABELS = [
  "Recepção do pet",
  "Avaliação inicial",
  "Escovação e desembolo",
  "Banho",
  "Secagem",
  "Tosa",
  "Corte de unhas",
  "Limpeza de ouvidos",
  "Perfume e acabamento",
  "Pet pronto para retirada",
] as const;

// Serviço oferecido pelo petshop (cadastro/edição no CRM; some no app do tutor)
export const serviceTypeInput = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional(),
  price_cents: z.number().int().min(0),
  duration_min: z.number().int().positive("Informe a duração em minutos"),
  active: z.boolean().optional(),
  // Etapas escolhidas na biblioteca, na ordem em que viram checklist.
  step_ids: z
    .array(z.string().uuid())
    .max(SERVICE_STEP_LIBRARY_MAX)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Etapa repetida no serviço",
    )
    .optional(),
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

// Variação (SKU) do produto: cor + tamanho + peso, com preço e estoque
// próprios. Espelha product_variant (0020_product_variants.sql).
export const productVariantInput = z
  .object({
    // Presente = variação já existente (update); ausente = nova (insert).
    id: z.string().uuid().optional(),
    color_name: z.string().trim().min(1).optional(),
    color_hex: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida")
      .optional(),
    size: z.string().trim().min(1).max(30).optional(),
    weight_value: z.number().positive().optional(),
    weight_unit: z.enum(WEIGHT_UNITS).optional(),
    price_cents: z.number().int().min(0),
    stock: z.number().int().min(0),
    active: z.boolean().default(true),
  })
  .refine((v) => !!v.color_name || !!v.size || v.weight_value !== undefined, {
    message: "Cada variação precisa de ao menos cor, tamanho ou peso",
  })
  .refine((v) => !!v.color_name === !!v.color_hex, {
    message: "Cor incompleta",
  })
  .refine((v) => (v.weight_value !== undefined) === !!v.weight_unit, {
    message: "Informe o peso e a unidade",
  });
export type ProductVariantInput = z.infer<typeof productVariantInput>;

// Produto do catálogo (cadastro/edição no CRM)
export const productInput = z.object({
  name: z.string().min(1, "Informe o nome"),
  description: z.string().optional(),
  category: z.enum(PRODUCT_CATEGORIES, { message: "Selecione uma categoria" }),
  // Com variações, price_cents e stock são derivados no banco (soma dos
  // estoques / menor preço) e o que vem do formulário é ignorado.
  price_cents: z.number().int().min(0),
  stock: z.number().int().min(0),
  min_stock: z.number().int().min(0).default(0),
  active: z.boolean().optional(),
  // false = item de uso interno do petshop (não aparece no app dos tutores)
  for_sale: z.boolean().optional(),
  variants: z.array(productVariantInput).optional(),
});
export type ProductInput = z.infer<typeof productInput>;

// --- Câmeras (transmissão ao vivo do atendimento) ---
// Credencial é a "Conta da Câmera" criada no app Tapo (Configurações do
// Dispositivo → Configurações Avançadas → Conta da Câmera): 6–32 caracteres,
// diferente da conta TP-Link. stream1 = 1080p, stream2 = ~360p (internet fraca).
export const CAMERA_STREAM_PATHS = ["stream1", "stream2"] as const;
export const cameraInput = z.object({
  room_label: z.string().min(1, "Informe o nome da sala"),
  host: z.string().min(1, "Informe o IP da câmera na rede local"),
  port: z.number().int().min(1).max(65535),
  stream_path: z.enum(CAMERA_STREAM_PATHS),
  username: z
    .string()
    .min(6, "Usuário da Conta da Câmera tem 6 a 32 caracteres")
    .max(32, "Usuário da Conta da Câmera tem 6 a 32 caracteres"),
  // Opcional na edição: vazio mantém a senha já cadastrada.
  password: z
    .string()
    .min(6, "Senha da Conta da Câmera tem 6 a 32 caracteres")
    .max(32, "Senha da Conta da Câmera tem 6 a 32 caracteres")
    .optional(),
  active: z.boolean().optional(),
});
export type CameraInput = z.infer<typeof cameraInput>;

// Dias que as gravações ficam disponíveis para o tutor antes da limpeza.
export const RECORDING_RETENTION_OPTIONS = [7, 15, 30] as const;
export const DEFAULT_RECORDING_RETENTION_DAYS = 7;

// Finalidade LGPD registrada em `consent` para a câmera ao vivo + gravação.
export const CAMERA_CONSENT_PURPOSE = "transmissão e gravação do atendimento";

// --- Maquininhas e taxas (0036_payment_terminal_fees.sql) ---

// O banco aceita até 24x; a venda oferece MAX_INSTALLMENTS (enums.ts).
const installmentsField = z
  .number()
  .int()
  .min(1, "Número de parcelas inválido")
  .max(24, "Número de parcelas inválido");

const terminalIdField = z.string().uuid("Maquininha inválida").optional();

/** Só o crédito parcela — vale para toda cobrança que escolhe maquininha. */
function checkInstallments<
  T extends { payment_method: PaymentMethod; installments?: number },
>(value: T, ctx: z.RefinementCtx) {
  if ((value.installments ?? 1) > 1 && value.payment_method !== "CREDIT_CARD") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installments"],
      message: "Só o crédito pode ser parcelado",
    });
  }
}

export const paymentTerminalInput = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Nome da maquininha tem 2 a 60 caracteres")
    .max(60, "Nome da maquininha tem 2 a 60 caracteres"),
  active: z.boolean().optional(),
  is_default: z.boolean().optional(),
});
export type PaymentTerminalInput = z.infer<typeof paymentTerminalInput>;

export const paymentFeeRuleInput = z
  .object({
    payment_method: z.enum(PAYMENT_METHODS),
    installments_from: installmentsField,
    installments_to: installmentsField,
    fee_percent: z
      .number()
      .min(0, "Taxa inválida")
      .max(100, "A taxa não pode passar de 100%"),
    fee_fixed_cents: z.number().int().min(0, "Tarifa fixa inválida"),
    settlement_days: z
      .number()
      .int()
      .min(0, "Prazo inválido")
      .max(365, "Prazo inválido"),
  })
  .superRefine((rule, ctx) => {
    if (rule.installments_to < rule.installments_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installments_to"],
        message: "A faixa de parcelas está invertida",
      });
    }
    if (
      rule.payment_method !== "CREDIT_CARD" &&
      (rule.installments_from !== 1 || rule.installments_to !== 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["installments_from"],
        message: "Só o crédito tem faixas de parcelas",
      });
    }
  });

export const paymentFeeRulesInput = z
  .object({
    terminal_id: z.string().uuid("Maquininha inválida"),
    rules: z.array(paymentFeeRuleInput).max(60, "Taxas demais"),
  })
  .superRefine((value, ctx) => {
    // Duas faixas cobrindo 3x deixariam a taxa aplicada à sorte do plano de
    // execução; a RPC recusa, mas o erro fica muito melhor aqui.
    const byMethod = new Map<string, [number, number][]>();
    for (const rule of value.rules) {
      const ranges = byMethod.get(rule.payment_method) ?? [];
      if (
        ranges.some(
          ([from, to]) =>
            rule.installments_from <= to && rule.installments_to >= from,
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules"],
          message: `Faixas de parcelas sobrepostas em ${rule.payment_method}`,
        });
        return;
      }
      ranges.push([rule.installments_from, rule.installments_to]);
      byMethod.set(rule.payment_method, ranges);
    }
  });
export type PaymentFeeRulesInput = z.infer<typeof paymentFeeRulesInput>;

// Lançamento financeiro manual (receita ou despesa)
export const financeEntryInput = z
  .object({
    type: z.enum(FINANCE_ENTRY_TYPES),
    description: z.string().min(2, "Descreva o lançamento"),
    category: z.string().optional(),
    amount_cents: z.number().int().positive("Informe o valor"),
    occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    payment_method: z.enum(PAYMENT_METHODS),
    terminal_id: terminalIdField,
    installments: installmentsField.optional(),
  })
  .superRefine(checkInstallments);
export type FinanceEntryInput = z.infer<typeof financeEntryInput>;

// Movimentação manual de estoque (entrada/saída)
export const stockMovementInput = z.object({
  product_id: z.string().uuid("Selecione um produto"),
  // Obrigatório quando o produto tem variações (validado na RPC): com elas o
  // estoque do produto é derivado e o ajuste tem de ser por variação.
  variant_id: z.string().uuid("Selecione a variação").optional(),
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.number().int().positive("Quantidade inválida"),
  note: z.string().optional(),
});
export type StockMovementInput = z.infer<typeof stockMovementInput>;

export const paidReservationInput = z
  .object({
    reservation_id: z.string().uuid(),
    payment_method: z.enum(PAYMENT_METHODS),
    terminal_id: terminalIdField,
    installments: installmentsField.optional(),
  })
  .superRefine(checkInstallments);
export type PaidReservationInput = z.infer<typeof paidReservationInput>;

export const counterSaleItemInput = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
});

export const counterSaleInput = z
  .object({
    tutor_id: z.string().uuid().optional(),
    payment_method: z.enum(PAYMENT_METHODS),
    idempotency_key: z.string().uuid(),
    items: z.array(counterSaleItemInput).min(1, "Adicione ao menos um produto"),
    terminal_id: terminalIdField,
    installments: installmentsField.optional(),
  })
  .superRefine(checkInstallments);
export type CounterSaleInput = z.infer<typeof counterSaleInput>;

export const productRefundItemInput = z.object({
  reservation_item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const productRefundInput = z.object({
  reservation_id: z.string().uuid(),
  payment_method: z.enum(PAYMENT_METHODS),
  reason: z.string().trim().min(3, "Informe o motivo").max(500),
  idempotency_key: z.string().uuid(),
  items: z.array(productRefundItemInput).min(1, "Selecione ao menos um item"),
});
export type ProductRefundInput = z.infer<typeof productRefundInput>;

export const serviceRefundInput = z.object({
  appointment_id: z.string().uuid(),
  payment_method: z.enum(PAYMENT_METHODS),
  reason: z.string().trim().min(3, "Informe o motivo").max(500),
  idempotency_key: z.string().uuid(),
});
export type ServiceRefundInput = z.infer<typeof serviceRefundInput>;
