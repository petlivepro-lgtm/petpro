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

export async function deleteProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = str(formData.get("id"));
  if (!id) return { ok: false, error: "Produto inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("product").delete().eq("id", id);
  if (error) {
    // FK restrict: produto presente em itens de reserva.
    if (error.code === "23503") {
      return { ok: false, error: "Produto está em reservas. Desative-o em vez de excluir." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/produtos");
  return { ok: true };
}
