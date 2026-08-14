"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveTenant } from "@/lib/tenant";
import { productInput, type ProductVariantInput } from "@mylivepet/types";

export type FormState = { ok: boolean; error?: string };

const BUCKET = "product-photos";

function str(v: FormDataEntryValue | null): string | undefined {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? undefined : s;
}

/** Lê o valor em centavos (inteiro) já enviado pelo CurrencyInput. */
function toCents(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toInt(v: FormDataEntryValue | null): number {
  const n = Number.parseInt(typeof v === "string" ? v : "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Sobe vários arquivos e retorna as URLs públicas. Cria o bucket sob demanda. */
async function uploadProductPhotos(
  tenantId: string,
  productId: string,
  files: File[],
): Promise<string[]> {
  if (files.length === 0) return [];
  const admin = createAdminClient();
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {
    // bucket já existe — ignorável.
  }
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${tenantId}/${productId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error) urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

/** Lê o JSON de variações enviado pelo ProductVariantsInput. */
function parseVariants(formData: FormData): unknown[] {
  try {
    const raw = JSON.parse(String(formData.get("variants") ?? "[]"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * Sincroniza as variações do produto: atualiza as que vieram com id, insere as
 * novas e apaga as que sumiram do formulário. O trigger de agregação
 * (0020_product_variants.sql) recalcula estoque e preço do produto a cada
 * escrita — por isso o produto nunca grava esses campos quando há variações.
 */
async function syncVariants(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  productId: string,
  variants: ProductVariantInput[],
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("product_variant")
    .select("id")
    .eq("product_id", productId);

  const keptIds = new Set(variants.map((v) => v.id).filter((id): id is string => !!id));
  const removed = (existing ?? []).map((v) => v.id).filter((id) => !keptIds.has(id));

  if (removed.length > 0) {
    const { error } = await supabase.from("product_variant").delete().in("id", removed);
    if (error) {
      // FK restrict: variação presente em itens de reserva.
      if (error.code === "23503") {
        return "Uma das variações está em reservas. Desmarque 'Disponível' em vez de removê-la.";
      }
      return error.message;
    }
  }

  for (const [index, v] of variants.entries()) {
    const row = {
      tenant_id: tenantId,
      product_id: productId,
      color_name: v.color_name ?? null,
      color_hex: v.color_hex ?? null,
      size: v.size ?? null,
      weight_value: v.weight_value ?? null,
      weight_unit: v.weight_unit ?? null,
      price_cents: v.price_cents,
      stock: v.stock,
      active: v.active,
      position: index,
    };
    const { error } = v.id
      ? await supabase.from("product_variant").update(row).eq("id", v.id)
      : await supabase.from("product_variant").insert(row);
    if (error) {
      // Índice único da combinação cor+tamanho+peso.
      if (error.code === "23505") return "Há duas variações com a mesma combinação.";
      return error.message;
    }
  }

  return null;
}

/** Resolve a lista final de fotos: URLs mantidas + novos uploads, no máx. 5. */
async function resolvePhotos(
  formData: FormData,
  tenantId: string,
  productId: string,
): Promise<string[]> {
  let kept: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("photos_kept") ?? "[]"));
    if (Array.isArray(raw)) kept = raw.filter((u): u is string => typeof u === "string");
  } catch {
    // JSON inválido — ignora as mantidas.
  }
  const newFiles = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const room = Math.max(0, 5 - kept.length);
  const uploaded = await uploadProductPhotos(tenantId, productId, newFiles.slice(0, room));
  return [...kept, ...uploaded].slice(0, 5);
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = productInput.safeParse({
    name: str(formData.get("name")),
    description: str(formData.get("description")),
    category: str(formData.get("category")),
    price_cents: toCents(formData.get("price")),
    stock: toInt(formData.get("stock")),
    min_stock: toInt(formData.get("min_stock")),
    active: formData.get("active") === "on",
    for_sale: formData.get("for_sale") === "on",
    variants: parseVariants(formData),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const { data: product, error } = await supabase
    .from("product")
    .insert({
      tenant_id: tenant.tenantId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      price_cents: parsed.data.price_cents,
      stock: parsed.data.stock,
      min_stock: parsed.data.min_stock,
      active: parsed.data.active ?? true,
      for_sale: parsed.data.for_sale ?? true,
    })
    .select("id")
    .single();
  if (error || !product) return { ok: false, error: error?.message ?? "Falha ao salvar" };

  const variantError = await syncVariants(
    supabase,
    tenant.tenantId,
    product.id,
    parsed.data.variants ?? [],
  );
  if (variantError) return { ok: false, error: variantError };

  const photos = await resolvePhotos(formData, tenant.tenantId, product.id);
  if (photos.length > 0) {
    await supabase
      .from("product")
      .update({ photos, photo_path: photos[0] ?? null })
      .eq("id", product.id);
  }

  revalidatePath("/produtos");
  return { ok: true };
}

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Produto inválido" };

  const parsed = productInput.safeParse({
    name: str(formData.get("name")),
    description: str(formData.get("description")),
    category: str(formData.get("category")),
    price_cents: toCents(formData.get("price")),
    stock: toInt(formData.get("stock")),
    min_stock: toInt(formData.get("min_stock")),
    active: formData.get("active") === "on",
    for_sale: formData.get("for_sale") === "on",
    variants: parseVariants(formData),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const tenant = await getActiveTenant(supabase);
  if (!tenant) return { ok: false, error: "Sem petshop vinculado" };

  const variants = parsed.data.variants ?? [];
  const photos = await resolvePhotos(formData, tenant.tenantId, id);
  const update: Record<string, unknown> = {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category,
    min_stock: parsed.data.min_stock,
    active: parsed.data.active ?? true,
    for_sale: parsed.data.for_sale ?? true,
    photos,
    photo_path: photos[0] ?? null,
  };
  // Com variações, preço e estoque são derivados delas por trigger; enviá-los
  // aqui seria ignorado pelo product_derived_guard de todo jeito.
  if (variants.length === 0) {
    update.price_cents = parsed.data.price_cents;
    update.stock = parsed.data.stock;
  }

  const { error } = await supabase.from("product").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const variantError = await syncVariants(supabase, tenant.tenantId, id, variants);
  if (variantError) return { ok: false, error: variantError };

  revalidatePath("/produtos");
  return { ok: true };
}

/**
 * O que o petshop perde ao excluir o produto — lido antes de abrir o aviso,
 * para o popup falar de números reais em vez de um genérico "não pode ser
 * desfeita".
 */
export type ProductDeletionImpact = {
  /** Reservas RESERVED/PICKED: bloqueiam a exclusão até serem resolvidas. */
  activeReservations: number;
  /** Itens em reservas já encerradas — viram histórico com o nome em snapshot. */
  pastReservations: number;
  /** Quantos desses itens são venda concluída (entram no financeiro). */
  sales: number;
  /** Movimentações de estoque, que são apagadas junto (cascade, 0012). */
  stockMovements: number;
};

const RESERVATION_ITEM_IMPACT_SELECT = "quantity, product_reservation(status)";

type ImpactRow = { quantity: number; product_reservation: { status: string } | null };

/** Reservas que ainda estão em andamento — o produto não pode sumir no meio. */
const ACTIVE_RESERVATION_STATUS = ["RESERVED", "PICKED"];
/** Reservas que geraram receita (o estorno mantém o item, então conta igual). */
const SALE_RESERVATION_STATUS = ["COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"];

async function loadDeletionImpact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
): Promise<ProductDeletionImpact> {
  const [{ data: items }, { count: movements }] = await Promise.all([
    supabase
      .from("product_reservation_item")
      .select(RESERVATION_ITEM_IMPACT_SELECT)
      .eq("product_id", productId),
    supabase
      .from("stock_movement")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId),
  ]);

  const impact: ProductDeletionImpact = {
    activeReservations: 0,
    pastReservations: 0,
    sales: 0,
    stockMovements: movements ?? 0,
  };

  for (const row of (items ?? []) as unknown as ImpactRow[]) {
    const status = row.product_reservation?.status ?? "";
    if (ACTIVE_RESERVATION_STATUS.includes(status)) {
      impact.activeReservations += 1;
      continue;
    }
    impact.pastReservations += 1;
    if (SALE_RESERVATION_STATUS.includes(status)) impact.sales += 1;
  }

  return impact;
}

/** Consultado pelo popup de exclusão ao abrir. */
export async function getProductDeletionImpact(
  productId: string,
): Promise<ProductDeletionImpact> {
  const supabase = await createClient();
  return loadDeletionImpact(supabase, productId);
}

export type DeleteProductState = FormState & {
  /** Exclusão barrada por reservas em andamento. */
  blocked?: boolean;
  impact?: ProductDeletionImpact;
};

/**
 * Exclui o produto de fato. Desde a 0037 o histórico sobrevive à exclusão
 * (o item da reserva guarda nome, preço e variação em snapshot), então o
 * bloqueio antigo por FK deixou de existir — no lugar dele ficam duas
 * travas de produto: reserva em andamento impede, e histórico exige o
 * "confirm" que o popup só envia depois do aviso.
 */
export async function deleteProduct(
  _prev: DeleteProductState,
  formData: FormData,
): Promise<DeleteProductState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Produto inválido" };

  const supabase = await createClient();
  const impact = await loadDeletionImpact(supabase, id);

  if (impact.activeReservations > 0) {
    const n = impact.activeReservations;
    return {
      ok: false,
      blocked: true,
      impact,
      error: `Há ${n} ${n > 1 ? "reservas em andamento" : "reserva em andamento"} com este produto. Conclua ou cancele ${n > 1 ? "essas reservas" : "essa reserva"} antes de excluir.`,
    };
  }

  // Rede de segurança: sem o aviso confirmado, nada é apagado — mesmo que a
  // checagem de impacto do popup tenha falhado no cliente.
  if (impact.pastReservations > 0 && formData.get("confirm") !== "1") {
    return {
      ok: false,
      impact,
      error: "Confirme que entendeu que a exclusão é permanente.",
    };
  }

  const { error } = await supabase.from("product").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return { ok: false, error: "Produto ainda está vinculado a outros registros." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/produtos");
  return { ok: true };
}
