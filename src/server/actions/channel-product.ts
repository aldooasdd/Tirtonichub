"use server";

import { randomUUID } from "node:crypto";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { DEMO, mustShop, syncItems } from "@/server/marketplace/sync";
import * as tp from "@/server/marketplace/tiktok-product";
import { textToHtml, type ProductDraft } from "@/lib/product-draft";
import { PRODUK_KE_MARKETPLACE, PRODUK_OFF_MSG } from "@/lib/flags";

// Buat & edit produk Tokopedia dari Tirtonic Channel.
type Res<T = undefined> = { ok: true; data?: T } | { ok: false; message: string };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

async function ctx() {
  const shop = await mustShop("TOKOPEDIA");
  if (shop.shopId === DEMO) throw new Error("Mode contoh: sambungkan toko Tokopedia asli untuk membuat / mengedit produk.");
  return { token: shop.accessToken, cipher: shop.cipher ?? "" };
}

async function run<T>(fn: () => Promise<T>): Promise<Res<T>> {
  await requireChannel();
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

// ---------- data pendukung form ----------
export async function catSearch(keyword: string) {
  return run(async () => (keyword.trim().length < 2 ? [] : tp.searchCategories(await ctx(), keyword.trim())));
}

export async function catRecommend(title: string, description: string, imageUris: string[]) {
  return run(async () => {
    if (title.trim().length < 5) throw new Error("Isi judul produk dulu.");
    return tp.recommendCategory(await ctx(), title.trim(), description ? textToHtml(description) : undefined, imageUris.slice(0, 9));
  });
}

export async function catInfo(categoryId: string) {
  return run(async () => {
    const c = await ctx();
    const [attributes, rules] = await Promise.all([tp.categoryAttributes(c, categoryId), tp.categoryRules(c, categoryId)]);
    return { attributes, rules };
  });
}

export async function brandSearch(categoryId: string | null, name: string) {
  return run(async () => tp.brands(await ctx(), categoryId, name.trim()));
}

const IMAGE_USES = ["MAIN_IMAGE", "ATTRIBUTE_IMAGE", "DESCRIPTION_IMAGE", "CERTIFICATION_IMAGE", "SIZE_CHART_IMAGE"] as const;

/** Upload gambar (kind = use case) atau file (kind = FILE: PDF sertifikat / video). */
export async function uploadMedia(fd: FormData) {
  return run(async () => {
    const file = fd.get("file");
    const kind = String(fd.get("kind") ?? "");
    if (!(file instanceof File) || !file.size) throw new Error("Pilih file.");
    const c = await ctx();
    if (kind === "FILE") {
      if (!/^(application\/pdf|video\/)/.test(file.type)) throw new Error("File harus PDF atau video.");
      if (file.size > 25 * 1024 * 1024) throw new Error("File maksimal 25MB.");
      const name = file.name.replace(/\.(?=.*\.)/g, "_"); // dokumen: tak boleh titik lain selain sebelum ekstensi
      const r = await tp.uploadFile(c, file, name);
      return { id: r.id, url: r.url, name: r.name, uri: "" };
    }
    if (!IMAGE_USES.includes(kind as (typeof IMAGE_USES)[number])) throw new Error("Jenis gambar tidak dikenal.");
    if (!/^image\/(jpe?g|png|webp)$/.test(file.type)) throw new Error("Gambar harus JPG, PNG, atau WEBP.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Gambar maksimal 5MB.");
    const r = await tp.uploadImage(c, file, file.name, kind as tp.ImageUse);
    return { id: "", url: r.url, name: file.name, uri: r.uri };
  });
}

// ---------- susun body API ----------
const norm = (s: string) => s.trim().toLowerCase();

function attributesBody(draft: ProductDraft, defs: tp.Attribute[]) {
  const byId = new Map(defs.map((a) => [a.id, a]));
  return draft.attributes
    .map((a) => {
      const def = byId.get(a.id);
      const parts = (def?.multiple ? a.value.split(",") : [a.value]).map((v) => v.trim()).filter(Boolean);
      const values = parts.map((v) => {
        const hit = def?.values.find((x) => norm(x.name) === norm(v));
        return hit ? { id: hit.id } : { name: v };
      });
      return { id: a.id, values };
    })
    .filter((a) => a.values.length);
}

function packageBody(d: ProductDraft) {
  const w = Number(d.weightKg.replace(",", "."));
  if (!(w > 0)) throw new Error("Isi berat paket (kg).");
  const dims = [d.length, d.width, d.height].map((x) => Math.round(Number(x)));
  return {
    package_weight: { value: String(Math.round(w * 1000) / 1000), unit: "KILOGRAM" },
    ...(dims.every((x) => x > 0) ? { package_dimensions: { length: String(dims[0]), width: String(dims[1]), height: String(dims[2]), unit: "CENTIMETER" } } : {}),
  };
}

function commonBody(d: ProductDraft, defs: tp.Attribute[]) {
  const onlyToko = d.platforms.length === 1 && d.platforms[0] === "TOKOPEDIA";
  return {
    title: d.title.trim(),
    ...(d.description !== undefined ? { description: textToHtml(d.description) } : {}),
    main_images: d.images.slice(0, 9).map((i) => ({ uri: i.uri })),
    ...(d.brandId ? { brand_id: d.brandId } : {}),
    product_attributes: attributesBody(d, defs),
    ...packageBody(d),
    ...(d.cod !== undefined ? { is_cod_allowed: d.cod } : {}),
    ...(d.minOrder ? { minimum_order_quantity: Math.min(20, Math.max(1, Math.round(d.minOrder))) } : {}),
    ...(onlyToko && d.preOwned !== undefined ? { is_pre_owned: d.preOwned } : {}),
    ...(d.certifications.length
      ? {
          certifications: d.certifications
            .filter((x) => x.images.length || x.files.length)
            .map((x) => ({ id: x.id, images: x.images.map((i) => ({ uri: i.uri })), files: x.files.map((f) => ({ id: f.id, name: f.name, format: "PDF" })) })),
        }
      : {}),
    ...(d.sizeChart ? { size_chart: { image: { uri: d.sizeChart.uri } } } : {}),
    ...(d.video ? { video: { id: d.video.id } } : {}),
  };
}

function validate(d: ProductDraft) {
  const t = d.title.trim();
  if (t.length < 25 || t.length > 255) throw new Error("Judul produk 25–255 karakter.");
  if (!d.images.length) throw new Error("Tambahkan minimal 1 foto produk.");
  if (!d.categoryId) throw new Error("Pilih kategori.");
  if (!d.platforms.length) throw new Error("Pilih minimal 1 platform.");
}

async function createBody(c: { token: string; cipher: string }, d: ProductDraft, defs: tp.Attribute[]) {
  const variants = d.variants ?? [];
  if (!variants.length) throw new Error("Isi harga & stok.");
  const wh = await tp.defaultWarehouse(c);
  const name = (d.variantName ?? "").trim();
  const salesDef = name ? defs.find((a) => a.sales && norm(a.name) === norm(name)) : undefined;
  if (name && variants.some((v) => !v.value.trim())) throw new Error("Isi nama setiap varian.");
  const skus = variants.map((v) => {
    if (!(v.price > 0)) throw new Error("Harga harus lebih dari 0.");
    const hit = salesDef?.values.find((x) => norm(x.name) === norm(v.value));
    return {
      ...(name
        ? {
            sales_attributes: [
              {
                ...(salesDef ? { id: salesDef.id } : { name }),
                ...(hit ? { value_id: hit.id } : { value_name: v.value.trim() }),
                ...(v.image ? { sku_img: { uri: v.image.uri } } : {}),
              },
            ],
          }
        : {}),
      ...(v.sellerSku.trim() ? { seller_sku: v.sellerSku.trim() } : {}),
      price: { amount: String(Math.round(v.price)), currency: "IDR" },
      inventory: [{ warehouse_id: wh, quantity: Math.max(0, Math.round(v.stock)) }],
    };
  });
  return {
    ...commonBody(d, defs),
    category_id: d.categoryId,
    skus,
    listing_platforms: d.platforms,
    save_mode: d.saveMode,
    ...(d.shippingTemplateId ? { shipping_template_id: d.shippingTemplateId } : {}),
  };
}

/** Edit penuh (ganti kategori): ambil produk asli, pertahankan SKU, timpa field dari form. */
async function fullEditBody(c: { token: string; cipher: string }, d: ProductDraft, defs: tp.Attribute[]) {
  const raw = await tp.productRaw(c, d.productId!);
  const skus = (raw.skus ?? []).map((s) => ({
    id: s.id,
    ...(s.seller_sku ? { seller_sku: s.seller_sku } : {}),
    price: { amount: s.price?.sale_price ?? s.price?.tax_exclusive_price ?? "0", currency: s.price?.currency ?? "IDR" },
    inventory: (s.inventory ?? []).map((i) => ({ warehouse_id: i.warehouse_id, quantity: i.quantity })),
    sales_attributes: (s.sales_attributes ?? []).map((a) => ({ id: a.id, ...(a.value_id ? { value_id: a.value_id } : { value_name: a.value_name }), ...(a.sku_img?.uri ? { sku_img: { uri: a.sku_img.uri } } : {}) })),
  }));
  return {
    description: raw.description ?? "",
    ...(raw.video?.id ? { video: { id: raw.video.id } } : {}),
    ...commonBody(d, defs),
    category_id: d.categoryId,
    skus,
  };
}

async function buildBody(d: ProductDraft) {
  validate(d);
  const c = await ctx();
  const defs = await tp.categoryAttributes(c, d.categoryId);
  const body = !d.productId ? await createBody(c, d, defs) : d.categoryChanged ? await fullEditBody(c, d, defs) : commonBody(d, defs);
  return { c, body };
}

// ---------- cek & simpan ----------
/** Cek kelayakan listing + syarat toko + template ongkir, tanpa menyimpan. */
export async function checkProduct(d: ProductDraft) {
  return run(async () => {
    const { c, body } = await buildBody(d);
    const full = d.productId && !d.categoryChanged ? { ...body, category_id: d.categoryId } : body;
    const [check, templates] = await Promise.all([tp.checkListing(c, full), tp.shippingTemplates(c).catch(() => [])]);
    return { check, templates };
  });
}

export async function saveProduct(d: ProductDraft) {
  const auth = await requireChannel();
  if (!PRODUK_KE_MARKETPLACE) return { ok: false as const, message: PRODUK_OFF_MSG };
  try {
    const { c, body } = await buildBody(d);
    const r = !d.productId
      ? await tp.createProduct(c, { ...body, idempotency_key: randomUUID() })
      : d.categoryChanged
        ? await tp.editProduct(c, d.productId, body)
        : await tp.partialEditProduct(c, d.productId, body);
    const { ip } = await clientMeta();
    await logActivity({ ...auth, ip }, { action: d.productId ? "channel_product_edit" : "channel_product_create", entity: "MarketplaceProduct", entityId: r.productId, after: { title: d.title } });
    void syncItems("TOKOPEDIA").catch(() => {}); // tarik produk + detail terbaru di latar belakang
    return { ok: true as const, data: r };
  } catch (e) {
    return { ok: false as const, message: errMsg(e) };
  }
}
