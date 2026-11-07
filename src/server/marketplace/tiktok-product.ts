// Tokopedia (TikTok Shop API): buat & edit produk + data pendukung (kategori, atribut, aturan, merek, upload, cek listing).
// Sesuai dokumen di ~/Downloads (Create Product, Edit Product, Partial Edit Product, Get Categories, dst).
import { call } from "./tiktok";
import { upload, warehouses } from "./tiktok-ops";

type Ctx = { token: string; cipher: string };
const enc = encodeURIComponent;
const LOCALE = "id-ID";

// ---------- kategori, atribut, aturan, merek ----------
export type Category = { id: string; name: string; path: string; allowed: boolean };

/** Cari kategori daun Tokopedia per kata kunci. */
export async function searchCategories(c: Ctx, keyword: string): Promise<Category[]> {
  const d = await call<{ categories?: { id: string; parent_id: string; local_name: string; is_leaf: boolean; permission_statuses?: string[] }[] }>(
    "/product/202309/categories",
    { ...c, query: { locale: LOCALE, keyword, listing_platform: "TOKOPEDIA" } },
  );
  const all = d.categories ?? [];
  const byId = new Map(all.map((x) => [x.id, x]));
  const path = (id: string) => {
    const out: string[] = [];
    for (let x = byId.get(id); x && out.length < 8; x = byId.get(x.parent_id)) out.unshift(x.local_name);
    return out.join(" › ");
  };
  return all
    .filter((x) => x.is_leaf)
    .slice(0, 50)
    .map((x) => ({ id: x.id, name: x.local_name, path: path(x.id), allowed: !x.permission_statuses?.length || x.permission_statuses.includes("AVAILABLE") }));
}

/** Rekomendasi kategori dari judul (+ deskripsi, foto). */
export async function recommendCategory(c: Ctx, title: string, description?: string, imageUris: string[] = []): Promise<Category | null> {
  const d = await call<{ leaf_category_id?: string; categories?: { id: string; name: string; permission_statuses?: string[] }[] }>("/product/202309/categories/recommend", {
    ...c,
    method: "POST",
    body: { product_title: title, ...(description ? { description } : {}), ...(imageUris.length ? { images: imageUris.map((uri) => ({ uri })) } : {}), listing_platform: "TOKOPEDIA", locale: LOCALE },
  });
  const chain = d.categories ?? [];
  const leaf = chain.find((x) => x.id === d.leaf_category_id) ?? chain.at(-1);
  if (!d.leaf_category_id || !leaf) return null;
  return {
    id: d.leaf_category_id,
    name: leaf.name,
    path: chain.map((x) => x.name).join(" › "),
    allowed: !leaf.permission_statuses?.length || leaf.permission_statuses.includes("AVAILABLE"),
  };
}

export type Attribute = { id: string; name: string; sales: boolean; required: boolean; custom: boolean; multiple: boolean; values: { id: string; name: string }[] };
export async function categoryAttributes(c: Ctx, categoryId: string): Promise<Attribute[]> {
  const d = await call<{
    attributes?: { id: string; name: string; type: string; is_requried?: boolean; is_customizable?: boolean; is_multiple_selection?: boolean; values?: { id: string; name: string }[] }[];
  }>(`/product/202309/categories/${enc(categoryId)}/attributes`, { ...c, query: { locale: LOCALE } });
  return (d.attributes ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    sales: a.type === "SALES_PROPERTY",
    required: !!a.is_requried, // ejaan "requried" sesuai API
    custom: !!a.is_customizable,
    multiple: !!a.is_multiple_selection,
    values: a.values ?? [],
  }));
}

export type CategoryRules = {
  certifications: { id: string; name: string; required: boolean; details: string | null; sample: string | null }[];
  sizeChartSupported: boolean;
  sizeChartRequired: boolean;
  codSupported: boolean | null;
  dimensionRequired: boolean;
};
export async function categoryRules(c: Ctx, categoryId: string): Promise<CategoryRules> {
  const d = await call<{
    product_certifications?: { id: string; name: string; is_required?: boolean; document_details?: string; sample_image_url?: string }[];
    size_chart?: { is_supported?: boolean; is_required?: boolean };
    cod?: { is_supported?: boolean };
    package_dimension?: { is_required?: boolean };
  }>(`/product/202309/categories/${enc(categoryId)}/rules`, { ...c, query: { locale: LOCALE } });
  return {
    certifications: (d.product_certifications ?? []).map((x) => ({
      id: x.id,
      name: x.name,
      required: !!x.is_required,
      details: x.document_details?.replace(/<br\s*\/?>/gi, "\n") || null,
      sample: x.sample_image_url || null,
    })),
    sizeChartSupported: !!d.size_chart?.is_supported,
    sizeChartRequired: !!d.size_chart?.is_required,
    codSupported: d.cod?.is_supported ?? null,
    dimensionRequired: !!d.package_dimension?.is_required,
  };
}

export type Brand = { id: string; name: string; authorized: boolean; available: boolean };
export async function brands(c: Ctx, categoryId: string | null, name: string): Promise<Brand[]> {
  const d = await call<{ brands?: { id: string; name: string; authorized_status?: string; brand_status?: string }[] }>("/product/202309/brands", {
    ...c,
    query: { page_size: 30, ...(categoryId ? { category_id: categoryId } : {}), ...(name ? { brand_name: name } : {}) },
  });
  return (d.brands ?? []).map((b) => ({ id: b.id, name: b.name, authorized: b.authorized_status === "AUTHORIZED", available: b.brand_status !== "UNAVAILABLE" }));
}

/** Kategori bisnis yang diizinkan partner untuk app (bukan kategori produk). */
export async function authorizedCategoryAssets(token: string): Promise<{ id: number; name: string; market: string }[]> {
  const d = await call<{ category_assets?: { target_market?: string; category?: { id: number; name: string } }[] }>("/authorization/202405/category_assets", { token });
  return (d.category_assets ?? []).map((a) => ({ id: a.category?.id ?? 0, name: a.category?.name ?? "-", market: a.target_market ?? "" }));
}

// ---------- syarat & cek ----------
export async function listingPrerequisites(c: Ctx): Promise<{ item: string; failed: boolean; reasons: string[] }[]> {
  const d = await call<{ check_results?: { check_item: string; is_failed?: boolean; fail_reasons?: string[] }[] }>("/product/202312/prerequisites", c);
  return (d.check_results ?? []).map((x) => ({ item: x.check_item, failed: !!x.is_failed, reasons: x.fail_reasons ?? [] }));
}

export type ListingCheck = { pass: boolean; reasons: string[]; warnings: string[] };
export async function checkListing(c: Ctx, body: Record<string, unknown>): Promise<ListingCheck> {
  const d = await call<{ check_result?: string; fail_reasons?: { message?: string }[]; warnings?: { message?: string } | { message?: string }[] }>("/product/202309/products/listing_check", {
    ...c,
    method: "POST",
    body,
  });
  const w = Array.isArray(d.warnings) ? d.warnings : d.warnings ? [d.warnings] : [];
  return { pass: d.check_result === "PASS", reasons: (d.fail_reasons ?? []).map((x) => x.message ?? "").filter(Boolean), warnings: w.map((x) => x.message ?? "").filter(Boolean) };
}

export type ShipTemplate = { id: string; name: string; available: boolean; isDefault: boolean; byPlatform: boolean; reasons: string[] };
/** Template ongkir toko + ketersediaannya (tanpa ukuran paket: endpoint GET, body tak bisa dikirim lewat fetch). */
export async function shippingTemplates(c: Ctx): Promise<ShipTemplate[]> {
  const d = await call<{
    templates?: { template_is_available?: boolean; template?: { template_id: string; template_name: string; is_default?: boolean; template_party?: number }; service_unreachable_reason?: { filter_reason?: { reason?: string }[] }[] }[];
  }>("/logistics/202510/seller_templates", c);
  return (d.templates ?? []).map((t) => ({
    id: t.template?.template_id ?? "",
    name: t.template?.template_name ?? "-",
    available: !!t.template_is_available,
    isDefault: !!t.template?.is_default,
    byPlatform: t.template?.template_party === 1,
    reasons: (t.service_unreachable_reason ?? []).flatMap((r) => (r.filter_reason ?? []).map((f) => f.reason ?? "")).filter(Boolean),
  }));
}

// ---------- upload ----------
export type ImageUse = "MAIN_IMAGE" | "ATTRIBUTE_IMAGE" | "DESCRIPTION_IMAGE" | "CERTIFICATION_IMAGE" | "SIZE_CHART_IMAGE";
export async function uploadImage(c: Ctx, file: Blob, name: string, useCase: ImageUse): Promise<{ uri: string; url: string }> {
  return upload<{ uri: string; url: string }>(c, "/product/202309/images/upload", file, name, { use_case: useCase });
}

/** PDF sertifikat atau video produk. */
export async function uploadFile(c: Ctx, file: Blob, name: string): Promise<{ id: string; url: string; name: string; format: string }> {
  return upload(c, "/product/202309/files/upload", file, name, { name });
}

// ---------- produk ----------
export type RawProduct = {
  id: string;
  title: string;
  description?: string;
  category_chains?: { id: string; local_name: string; is_leaf: boolean }[];
  brand?: { id: string; name: string };
  main_images?: { uri: string; urls?: string[] }[];
  video?: { id?: string };
  product_attributes?: { id: string; name: string; values?: { id?: string; name: string }[] }[];
  package_weight?: { value?: string; unit?: string };
  package_dimensions?: { length?: string; width?: string; height?: string; unit?: string };
  minimum_order_quantity?: number;
  is_cod_allowed?: boolean;
  is_pre_owned?: boolean;
  skus?: {
    id: string;
    seller_sku?: string;
    price?: { sale_price?: string; tax_exclusive_price?: string; currency?: string };
    inventory?: { quantity: number; warehouse_id: string }[];
    sales_attributes?: { id: string; name: string; value_id?: string; value_name?: string; sku_img?: { uri?: string } }[];
  }[];
  integrated_platform_statuses?: { platform: string; status: string }[];
};

export async function productRaw(c: Ctx, productId: string): Promise<RawProduct> {
  return call<RawProduct>(`/product/202309/products/${enc(productId)}`, { ...c, query: { locale: LOCALE } });
}

export async function defaultWarehouse(c: Ctx): Promise<string> {
  const ws = (await warehouses(c)).filter((w) => w.type === "SALES_WAREHOUSE");
  const w = ws.find((x) => x.isDefault && x.status === "ENABLED") ?? ws.find((x) => x.status === "ENABLED") ?? ws[0];
  if (!w) throw new Error("Toko belum punya gudang kirim. Atur gudang di Seller Center dulu.");
  return w.id;
}

type Saved = { productId: string; warnings: string[] };
const warn = (d: { warnings?: { message?: string }[] }) => (d.warnings ?? []).map((w) => w.message ?? "").filter(Boolean);

export async function createProduct(c: Ctx, body: Record<string, unknown>): Promise<Saved> {
  const d = await call<{ product_id: string; warnings?: { message?: string }[] }>("/product/202309/products", { ...c, method: "POST", body });
  return { productId: d.product_id, warnings: warn(d) };
}

/** Edit penuh (PUT): field yang tak dikirim dianggap dihapus. */
export async function editProduct(c: Ctx, productId: string, body: Record<string, unknown>): Promise<Saved> {
  const d = await call<{ warnings?: { message?: string }[] }>(`/product/202509/products/${enc(productId)}`, { ...c, method: "PUT", body });
  return { productId, warnings: warn(d ?? {}) };
}

/** Edit sebagian: hanya field yang dikirim yang berubah. */
export async function partialEditProduct(c: Ctx, productId: string, body: Record<string, unknown>): Promise<Saved> {
  const d = await call<{ warnings?: { message?: string }[] }>(`/product/202509/products/${enc(productId)}/partial_edit`, { ...c, method: "POST", body });
  return { productId, warnings: warn(d ?? {}) };
}
