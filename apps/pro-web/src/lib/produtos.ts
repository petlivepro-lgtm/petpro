// Colunas do catálogo de produtos — reutilizadas no render inicial (server) e
// no refetch em tempo real (client), garantindo o mesmo shape nos dois lados.
//
// Mora aqui, e não no componente client, porque os exports de um módulo
// "use client" viram referências de client component quando importados por um
// Server Component (a constante chegaria como proxy, não como string).
//
// String literal única (sem concatenação com +): é o que permite ao supabase-js
// inferir o tipo das linhas a partir do select.
export const PRODUCT_SELECT = `id, name, description, category, price_cents, stock, min_stock, active, for_sale, photo_path, photos,
  product_variant(id, color_name, color_hex, size, weight_value, weight_unit, price_cents, stock, active, position)`;
