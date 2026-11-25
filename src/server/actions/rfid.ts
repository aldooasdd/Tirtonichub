"use server";

// Pasangkan Tag (Tirtonic Channel): scan barcode SKU → muncul baris sebanyak stok → sapu stiker, baris terisi → Simpan. Reader HC-YK947 mode keyboard: tiap tag = kode + Enter.
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { buildCatalog } from "@/server/pos-catalog";

export type SkuInfo = {
  sku: string; name: string | null; variant: string | null; image: string | null;
  tagList: string[]; stock: number | null; stocks: { label: string; stock: number }[];
};
export type BatchRes = { tagList: string[]; other: { epc: string; sku: string }[] };

const clean = (list: string[]) => [...new Set(list.map((e) => e.trim().toUpperCase()).filter(Boolean))];

const same = (sku: string) => ({ equals: sku, mode: "insensitive" as const });
const tagsOf = async (sku: string) => (await prisma.rfidTag.findMany({ where: { sku: same(sku) }, orderBy: { createdAt: "asc" }, select: { epc: true } })).map((t) => t.epc);

/** Barang + stok sistem (per cabang, sama seperti Produk Quantity) + tag yang sudah terpasang. */
export async function lookupSku(raw: string): Promise<SkuInfo> {
  await requireChannel();
  const sku = raw.trim();
  // ponytail: muat katalog penuh per scan barcode (sekali per barang); cache kalau terasa lambat.
  const [cat, tagList] = await Promise.all([buildCatalog(null), tagsOf(sku)]);
  const it = cat.items.find((x) => x.key === sku.toLowerCase());
  return {
    sku: it?.sku ?? sku,
    name: it?.name ?? null,
    variant: it?.variant ?? null,
    image: it?.img ?? null,
    tagList,
    stock: it ? it.stock : null,
    stocks: it?.stocks.map((s) => ({ label: s.label, stock: s.stock })) ?? [],
  };
}

/** Pasang banyak tag sekaligus ke 1 SKU. Tag milik SKU lain tidak dipindah kecuali move=true. */
export async function pairTags(epcs: string[], rawSku: string, move = false): Promise<BatchRes> {
  const ctx = await requireChannel();
  const sku = rawSku.trim();
  const list = clean(epcs);
  const cur = await prisma.rfidTag.findMany({ where: { epc: { in: list } } });
  const owner = new Map(cur.map((t) => [t.epc, t.sku]));
  const added = list.filter((e) => !owner.has(e) || (move && owner.get(e)!.toLowerCase() !== sku.toLowerCase()));
  const other = move ? [] : cur.filter((t) => t.sku.toLowerCase() !== sku.toLowerCase()).map((t) => ({ epc: t.epc, sku: t.sku }));
  await prisma.$transaction([
    prisma.rfidTag.deleteMany({ where: { epc: { in: added } } }),
    prisma.rfidTag.createMany({ data: added.map((epc) => ({ epc, sku, userId: ctx.userId })) }),
  ]);
  return { tagList: await tagsOf(sku), other };
}

/** Lepas tag dari SKU (Data Tag). */
export async function unpairTags(epcs: string[], rawSku: string): Promise<void> {
  await requireChannel();
  const sku = rawSku.trim();
  await prisma.rfidTag.deleteMany({ where: { epc: { in: clean(epcs) }, sku: same(sku) } });
}

/** Pemilik tiap tag (yang belum terpasang tidak ada di hasil). */
export async function ownersOf(epcs: string[]): Promise<{ epc: string; sku: string }[]> {
  await requireChannel();
  return prisma.rfidTag.findMany({ where: { epc: { in: clean(epcs) } }, select: { epc: true, sku: true } });
}
