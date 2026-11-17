// Pindahkan produk Tokopedia di Produk Master ke tirtonic.com (lewat /api/hub action "import").
import { prisma } from "@/server/db";
import { bolehUbah } from "@/lib/flags";
import { DEMO } from "./sync";
import { websiteImport, websiteReady, websiteWeights, type WebImportProduct } from "./website";

// "1.2 KILOGRAM" / "500 GRAM" → gram.
function toGram(w: string | null | undefined): number | null {
  const m = (w ?? "").match(/([\d.,]+)\s*(KILOGRAM|KG|GRAM|G)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? Math.round(/^k/i.test(m[2]) ? n * 1000 : n) : null;
}

// "Warna: Putih, Ukuran: 1.30mm" → { warna: "Putih", ukuran: "1.30mm" }.
function splitVariant(label: string): { warna: string; ukuran: string } {
  const vals = label.split(/,\s*/).map((p) => p.split(/:\s*/).slice(1).join(":").trim() || p.trim()).filter(Boolean);
  return { warna: vals[0] ?? label, ukuran: vals.slice(1).join(" / ") };
}

type PushResult = { ok: boolean; message: string; total: number; created: number; updated: number; skipped: number; failed: string[] };

/** Kirim SEMUA produk Tokopedia di Produk Master ke tirtonic.com (detail + varian + stok).
 *  Upsert per produk (ref TOKOPEDIA:<itemId>) → aman diulang untuk update. Produk web bernama sama
 *  (dibuat manual) ditimpa oleh web. */
export async function pushTokopediaToWebCore(itemIds?: string[]): Promise<PushResult> {
  if (!websiteReady()) return { ok: false, message: "POINTS_API_SECRET belum diset — Tirtonichub belum tersambung ke tirtonic.com.", total: -1, created: 0, updated: 0, skipped: 0, failed: [] };

  const [items, details] = await Promise.all([
    prisma.marketplaceItem.findMany({
      where: { platform: "TOKOPEDIA", deletedAt: null, shopId: { not: DEMO }, NOT: { skuStatus: "DEACTIVATED" }, ...(itemIds ? { itemId: { in: itemIds } } : {}) },
      orderBy: { modelId: "asc" },
    }),
    prisma.marketplaceProduct.findMany({ where: { platform: "TOKOPEDIA", ...(itemIds ? { productId: { in: itemIds } } : {}) } }),
  ]);
  const det = new Map(details.map((d) => [d.productId, d]));
  const groups = new Map<string, typeof items>();
  for (const it of items) groups.set(it.itemId, [...(groups.get(it.itemId) ?? []), it]);

  const payloads: WebImportProduct[] = [...groups.entries()].map(([itemId, vs]) => {
    const d = det.get(itemId);
    const first = vs[0];
    const name = first.localName ?? d?.title ?? (first.variant && first.name.endsWith(` - ${first.variant}`) ? first.name.slice(0, -(first.variant.length + 3)) : first.name);
    const images = Array.isArray(d?.images) ? (d.images as unknown[]).map(String) : [];
    const base = { ref: `TOKOPEDIA:${itemId}`, name, brand: d?.brand ?? null, category: d?.category ?? null, description: d?.description ?? null, weightGram: toGram(d?.weight) };
    const single = vs.length === 1 && !first.variant;
    if (single) return { ...base, images: images.length ? images : [first.image].filter(Boolean) as string[], price: first.price, stock: first.stock };
    return {
      ...base,
      images: images.length ? images : [...new Set(vs.map((v) => v.image).filter(Boolean) as string[])],
      variants: vs.map((v) => ({ ...splitVariant(v.variant ?? v.localSku ?? v.sku ?? v.modelId), price: v.price, stock: v.stock, image: v.image })),
    };
  });

  let created = 0, updated = 0, skipped = 0;
  const failed: string[] = [];
  // ponytail: 4 paralel — cukup untuk ratusan produk; naikkan kalau terlalu lama.
  for (let i = 0; i < payloads.length; i += 4) {
    await Promise.all(payloads.slice(i, i + 4).map(async (p) => {
      try {
        const r = await websiteImport(p);
        if (r.skipped) skipped++;
        else if (r.created) created++;
        else updated++;
      } catch (e) {
        failed.push(`${p.name}: ${e instanceof Error ? e.message : e}`);
      }
    }));
  }
  const msg = `${payloads.length} produk Tokopedia → tirtonic.com: ${created} baru, ${updated} diperbarui${failed.length ? `, ${failed.length} gagal (${failed.slice(0, 3).join("; ")})` : ""}.`;
  return { ok: failed.length === 0, message: msg, total: payloads.length, created, updated, skipped, failed };
}

/** Sinkron BERAT semua produk marketplace (Tokopedia & Shopee) ke tirtonic.com untuk hitung ongkir.
 *  Web mencocokkan per ref (produk hasil impor) lalu per nama (produk dibuat manual); hanya berat yang diubah. */
export async function pushWeightsToWebCore(): Promise<{ ok: boolean; message: string; updated: number }> {
  if (!websiteReady()) return { ok: false, message: "POINTS_API_SECRET belum diset.", updated: 0 };
  if (!bolehUbah("WEBSITE")) return { ok: false, message: "Sinkron ke web sedang dimatikan.", updated: 0 };
  const [products, items] = await Promise.all([
    prisma.marketplaceProduct.findMany({ where: { weight: { not: null } }, select: { platform: true, productId: true, title: true, weight: true } }),
    prisma.marketplaceItem.findMany({ where: { deletedAt: null, shopId: { not: DEMO } }, select: { platform: true, itemId: true, name: true, localName: true } }),
  ]);
  const names = new Map<string, Set<string>>();
  for (const it of items) {
    const k = `${it.platform}:${it.itemId}`;
    const set = names.get(k) ?? new Set<string>();
    if (it.localName) set.add(it.localName);
    set.add(it.name);
    names.set(k, set);
  }
  const rows = products.flatMap((p) => {
    const gram = toGram(p.weight);
    if (!gram) return [];
    const ref = `${p.platform}:${p.productId}`;
    return [{ ref, gram, names: [p.title, ...(names.get(ref) ?? [])] }];
  });
  let updated = 0;
  // ponytail: 300 per request — payload kecil, cukup untuk ribuan produk.
  for (let i = 0; i < rows.length; i += 300) updated += (await websiteWeights(rows.slice(i, i + 300))).updated;
  return { ok: true, message: `${rows.length} berat produk dicek → ${updated} diperbarui di tirtonic.com.`, updated };
}
