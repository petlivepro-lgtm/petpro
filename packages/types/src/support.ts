// Suporte da plataforma (0073_support.sql). Os três apps falam a mesma língua:
// o petshop e o tutor abrem, o admin atende.

export type SupportStatus = "NEW" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";

/** Como o CLIENTE vê a situação (o admin tem rótulos próprios de fila). */
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  NEW: "Recebido",
  IN_PROGRESS: "Em análise",
  WAITING_CUSTOMER: "Respondido",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
};

export type SupportCategoryOption = { value: string; label: string; hint: string };

/** O que o petshop pode abrir (espelha o check da RPC open_support_ticket). */
export const TENANT_SUPPORT_CATEGORIES: SupportCategoryOption[] = [
  { value: "CAMERAS", label: "Câmeras", hint: "Câmera offline, imagem travando, gateway" },
  { value: "BUG", label: "Erro no sistema", hint: "Algo não funciona como deveria" },
  { value: "BILLING", label: "Assinatura e cobrança", hint: "Plano, fatura, cobrança" },
  { value: "HOW_TO", label: "Dúvida de uso", hint: "Como fazer algo no painel" },
  { value: "SUGGESTION", label: "Sugestão", hint: "Ideia para melhorar o Pet Live Pro" },
  { value: "PRIVACY", label: "Dados e privacidade", hint: "LGPD, exportar ou apagar dados" },
];

/** Assuntos do app que viram chamado para a plataforma. */
export const TUTOR_APP_TOPICS: SupportCategoryOption[] = [
  { value: "ACCESS", label: "Não consigo entrar", hint: "Senha, código, troca de celular" },
  { value: "LIVE_CAMERA", label: "A câmera ao vivo não abre", hint: "Tela carregando, sem imagem" },
  { value: "NOTIFICATIONS", label: "Não recebo notificações", hint: "Avisos do app não chegam" },
  { value: "BUG", label: "O app deu erro", hint: "Algo travou ou não funciona" },
  { value: "PRIVACY", label: "Meus dados e privacidade", hint: "Excluir conta, exportar dados" },
];

/**
 * Assuntos do PETSHOP: a triagem do tutor manda para o WhatsApp do petshop,
 * sem chamado. O valor é o `topic` de support_deflection.
 */
export const TUTOR_PETSHOP_TOPICS: SupportCategoryOption[] = [
  { value: "SCHEDULE", label: "Agendamento e horários", hint: "Marcar, remarcar, cancelar" },
  { value: "CARE", label: "Banho, tosa e cuidado com o pet", hint: "Como foi o atendimento" },
  { value: "PRICES", label: "Valores e pagamento", hint: "Preço de serviço, forma de pagar" },
  { value: "PRODUCTS", label: "Produtos e reservas", hint: "Reserva, retirada, estoque" },
  { value: "DELIVERY", label: "Leva-e-traz", hint: "Busca e entrega do pet" },
  { value: "CLUBINHO", label: "Clubinho", hint: "Pacote, créditos, renovação" },
];

export const SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  ...Object.fromEntries(TENANT_SUPPORT_CATEGORIES.map((c) => [c.value, c.label])),
  ...Object.fromEntries(TUTOR_APP_TOPICS.map((c) => [c.value, c.label])),
  BUG: "Erro no sistema",
  PETSHOP_REPORT: "Problema grave com o petshop",
  OTHER: "Outro",
};

/** Anexo: o que o servidor aceita, conferido pelos bytes iniciais do arquivo. */
export const SUPPORT_ATTACHMENT_MAX_BYTES = 4 * 1024 * 1024;

export function sniffSupportFile(bytes: Uint8Array): { mime: string; ext: string } | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { mime: "application/pdf", ext: "pdf" };
  return null;
}
