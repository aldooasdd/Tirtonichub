// Katalog barang ber-SKU + stok per cabang (gudang marketplace → cabang). Dipakai kasir /pos & Produk Quantity.
import { prisma } from "@/server/db";

export type PosProduct = { sku: string; name: string; price: number; stock: number };

// Harga toko: pakai listing Tirtonic.com dulu, lalu Tokopedia, Shopee.
const RANK: Record<string, number> = { WEBSITE: 0, TOKOPEDIA: 1, SHOPEE: 2 };
type Item = { platform: string; itemId?: string; name: string; localName: string | null; variant: string | null; sku: string | null; localSku: string | null; price: number; stock: number };
export const toProduct = (it: Item): PosProduct => ({
  sku: it.localSku ?? it.sku ?? "",
  name: it.localName ? `${it.localName}${it.variant ? ` - ${it.variant}` : ""}` : it.name,
  price: it.price,
  stock: it.stock,
});
export const best = <T extends Item>(items: T[]): T => [...items].sort((a, b) => (RANK[a.platform] ?? 9) - (RANK[b.platform] ?? 9))[0];

/** Katalog kasir: barang ber-SKU dari Produk Master (sementara, sampai SKU lengkap). Dimuat sekali,
 *  dicari & dicocokkan SKU di perangkat. `stocks` = stok tiap gudang/cabang → semua kasir lihat stok cabang lain. */
export type PosCatalogItem = PosProduct & { key: string; variant: string | null; img: string | null; stocks: { label: string; stock: number; mine: boolean; branchId: string | null }[] };
export type PosCatalog = { items: PosCatalogItem[]; branchStock: boolean };

type Wh = { id: string; stock: number };
let whNames: { at: number; map: Map<string, string> } | null = null;
// ponytail: nama gudang dari API marketplace, cache 10 menit di memori server.
async function warehouseNames() {
  if (whNames && Date.now() - whNames.at < 600_000) return whNames.map;
  const { loadWarehouses } = await import("@/server/pos-warehouses");
  const map = new Map((await loadWarehouses()).map((w) => [w.key, w.name]));
  whNames = { at: Date.now(), map };
  return map;
}


/** branchId = cabang mesin kasir (stok "mine"); null = tanpa cabang (dashboard). */
export async function buildCatalog(branchId: string | null): Promise<PosCatalog> {
  const [items, details, branches, names] = await Promise.all([
    prisma.marketplaceItem.findMany({
      where: { deletedAt: null, OR: [{ localSku: { not: null } }, { sku: { not: null } }] },
      select: { platform: true, itemId: true, modelId: true, name: true, localName: true, variant: true, sku: true, localSku: true, price: true, stock: true, image: true, whStock: true },
    }),
    prisma.marketplaceProduct.findMany({ select: { platform: true, productId: true, images: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, warehouseIds: true } }),
    warehouseNames().catch(() => new Map<string, string>()),
  ]);
  // Gudang → nama cabang pemiliknya (atau nama gudang bila belum dipetakan).
  const owner = new Map<string, { label: string; mine: boolean; branchId: string | null }>();
  for (const b of branches)
    for (const k of b.warehouseIds) owner.set(k, { label: b.name.split(/\s+/).pop() ?? b.name, mine: b.id === branchId, branchId: b.id });
  const cover = new Map(details.map((d) => [`${d.platform}:${d.productId}`, ((d.images as string[] | null) ?? [])[0] ?? null]));

  // Satu barang = SKU sama di semua marketplace.
  const groups = new Map<string, (typeof items)[number][]>();
  for (const it of items) {
    const k = toProduct(it).sku.trim().toLowerCase();
    if (k) (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }

  const list: PosCatalogItem[] = [];
  for (const [key, v] of groups) {
    // Gudang sama tercatat di 2 marketplace (stok cerminan) → pakai satu: Tokopedia dulu.
    const src = v.find((x) => x.platform === "TOKOPEDIA" && (x.whStock as Wh[] | null)?.length) ?? v.find((x) => (x.whStock as Wh[] | null)?.length);
    const per = new Map<string, { label: string; stock: number; mine: boolean; branchId: string | null }>();
    for (const w of (src?.whStock as Wh[] | undefined) ?? []) {
      const k = `${src!.platform}:${w.id}`;
      const o = owner.get(k) ?? { label: names.get(k) ?? (w.id ? `Gudang ${w.id.slice(-4)}` : "Gudang utama"), mine: false, branchId: null };
      const cur = per.get(o.label) ?? { ...o, stock: 0 };
      cur.stock += w.stock;
      per.set(o.label, cur);
    }
    const stocks = [...per.values()].sort((a, c) => Number(c.mine) - Number(a.mine) || a.label.localeCompare(c.label));
    const top = best(v);
    const mine = stocks.find((x) => x.mine);
    list.push({
      ...toProduct(top),
      key,
      stock: mine ? mine.stock : stocks.length ? stocks.reduce((n, x) => n + x.stock, 0) : top.stock,
      variant: top.variant,
      img: v.find((x) => x.image)?.image ?? cover.get(`${top.platform}:${top.itemId}`) ?? null,
      stocks,
    });
  }
  list.sort((a, c) => a.name.localeCompare(c.name));
  return { items: list, branchStock: owner.size > 0 && [...owner.values()].some((o) => o.mine) };
}
