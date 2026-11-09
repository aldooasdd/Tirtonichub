// Produk Master: gabung produk bernama sama dari Shopee, Tokopedia & Tirtonic.com jadi satu.
// Hanya tampilan — harga & stok tetap per marketplace (tidak ada sinkron lintas toko).
import { prisma } from "@/server/db";
import { DEMO } from "./sync";

type ItemRow = Awaited<ReturnType<typeof prisma.marketplaceItem.findMany>>[number];
type DetailRow = Awaited<ReturnType<typeof prisma.marketplaceProduct.findMany>>[number];

/** Kunci pencocokan nama: huruf kecil, hanya huruf/angka, spasi tunggal. */
export const productKey = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Nama produk tanpa label varian ("Nama - Merah" / "Nama (SKU)"). */
function baseTitle(vs: ItemRow[]): string {
  const strip = (it: ItemRow) => {
    if (it.variant && it.name.endsWith(` - ${it.variant}`)) return it.name.slice(0, -(it.variant.length + 3));
    return it.name.replace(/\s*\([^)]*\)$/, "");
  };
  if (vs.length > 1 && vs[0].platform === "SHOPEE" && !vs[0].variant) {
    // Shopee lama (tanpa field varian): ambil awalan bersama "Nama - …".
    let p = vs[0].name;
    for (const v of vs) while (!v.name.startsWith(p)) p = p.slice(0, -1);
    p = p.replace(/[\s\-–(/]+$/, "");
    if (p.length >= 8) return p;
  }
  return strip(vs[0]);
}

export type Listing = {
  platform: string;
  itemId: string;
  demo: boolean;
  title: string;
  stock: number;
  minPrice: number;
  maxPrice: number;
  variants: number;
  active: boolean;
  status: string | null; // status produk Tokopedia (detail)
};

export type ProductGroup = {
  key: string;
  title: string;
  image: string | null;
  category: string | null;
  brand: string | null;
  listings: Listing[];
  skus: string;
};

const ORDER: Record<string, number> = { TOKOPEDIA: 0, SHOPEE: 1, WEBSITE: 2 };

/** trash=true → hanya produk di Sampah. */
export async function loadProductGroups(trash = false): Promise<ProductGroup[]> {
  const [items, details] = await Promise.all([
    prisma.marketplaceItem.findMany({ where: { deletedAt: trash ? { not: null } : null }, orderBy: { name: "asc" } }),
    prisma.marketplaceProduct.findMany(),
  ]);
  const det = new Map<string, DetailRow>(details.map((d) => [`${d.platform}:${d.productId}`, d]));

  const byProduct = new Map<string, ItemRow[]>();
  for (const it of items) {
    const k = `${it.platform}:${it.itemId}`;
    (byProduct.get(k) ?? byProduct.set(k, []).get(k)!).push(it);
  }

  const groups = new Map<string, ProductGroup>();
  for (const [k, vs] of byProduct) {
    const d = det.get(k);
    const title = vs.find((v) => v.localName)?.localName ?? d?.title ?? baseTitle(vs);
    const prices = vs.map((v) => v.price);
    const listing: Listing = {
      platform: vs[0].platform,
      itemId: vs[0].itemId,
      demo: vs[0].shopId === DEMO,
      title,
      stock: vs.reduce((n, v) => n + v.stock, 0),
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      variants: vs.length,
      active: d ? d.status === "ACTIVATE" : vs.some((v) => v.skuStatus !== "DEACTIVATED"),
      status: d?.status ?? null,
    };
    const gk = productKey(title) || k;
    const g = groups.get(gk);
    const image = ((d?.images as string[] | undefined) ?? [])[0] ?? vs.find((v) => v.image)?.image ?? null;
    if (!g) {
      groups.set(gk, {
        key: gk,
        title,
        image,
        category: d?.category?.split(" › ").pop() ?? null,
        brand: d?.brand ?? null,
        listings: [listing],
        skus: vs.map((v) => v.localSku ?? v.sku ?? "").join(" "),
      });
    } else {
      g.listings.push(listing);
      g.image ??= image;
      g.category ??= d?.category?.split(" › ").pop() ?? null;
      g.brand ??= d?.brand ?? null;
      g.skus += " " + vs.map((v) => v.localSku ?? v.sku ?? "").join(" ");
    }
  }
  for (const g of groups.values()) g.listings.sort((a, b) => (ORDER[a.platform] ?? 9) - (ORDER[b.platform] ?? 9));
  return [...groups.values()];
}

/** Grup yang memuat produk (platform, itemId) ini. */
export async function loadProductGroupOf(platform: string, itemId: string, trash = false): Promise<ProductGroup | null> {
  return (await loadProductGroups(trash)).find((g) => g.listings.some((l) => l.platform === platform && l.itemId === itemId)) ?? null;
}
