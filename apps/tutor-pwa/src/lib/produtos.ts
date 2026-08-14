// Colunas do catálogo e das reservas — reutilizadas no render inicial (server)
// e no refetch em tempo real (client), garantindo o mesmo shape nos dois lados.
//
// Mora aqui, e não no componente client, porque os exports de um módulo
// "use client" viram referências de client component quando importados por um
// Server Component (a constante chegaria como proxy, não como string).
//
// String literal única (sem concatenação com +): é o que permite ao supabase-js
// inferir o tipo das linhas a partir do select.
export const PRODUCT_SELECT = `id, name, description, category, price_cents, stock, photo_path, photos,
  product_variant(id, color_name, color_hex, size, weight_value, weight_unit, price_cents, stock, position)`;

// product_name é o snapshot da 0037: o produto pode ter sido excluído do
// catálogo depois da reserva, e aí o embed `product` vem nulo.
export const RESERVATION_SELECT = `id, status, note, expires_at, created_at, rejection_reason, rejected_at, rejection_seen_at,
  product_reservation_item(id, quantity, price_cents, variant_label, product_name, product:product_id(name, photo_path))`;

/**
 * Reservas visíveis para o tutor: as ativas sempre, e as recusadas dos últimos
 * 7 dias — para ele ver o motivo escrito pelo petshop antes de sumirem.
 */
export const REJECTED_WINDOW_DAYS = 7;

export function reservationVisibilityFilter(): string {
  return `status.in.(RESERVED,PICKED),and(status.eq.REJECTED,rejected_at.gte.${rejectedSince()})`;
}

export function rejectedSince(): string {
  return new Date(Date.now() - REJECTED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// Aviso de recusa exibido na home: só o necessário para o card.
export const REJECTION_NOTICE_SELECT = `id, rejection_reason, rejected_at,
  product_reservation_item(id, quantity, variant_label, product_name, product:product_id(name))`;
