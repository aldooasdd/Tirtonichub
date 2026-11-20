"use server";

// Pasangkan Tag (Tirtonic Channel): scan barcode SKU → sapu semua stiker barang itu sekaligus → tersimpan,
// langsung dibandingkan dengan stok sistem. Reader HC-YK947 mode keyboard: tiap tag = kode + Enter.
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { buildCatalog } from "@/server/pos-catalog";

export type SkuInfo = {
  sku: string; name: string | null; variant: string | null; image: string | null;
  tags: number; stock: number | null; stocks: { label: string; stock: number }[];
};
export type BatchRes = { added: string[]; already: number; other: { epc: string; sku: string }[]; tags: number };

const clean = (list: string[]) => [...new Set(list.map((e) => e.trim().toUpperCase()).filter(Boolean))];

/** Barang + stok sistem (per cabang, sama seperti Produk Quantity) + jumlah tag terpasang. */
export async function lookupSku(raw: string): Promise<SkuInfo> {
  await requireChannel();
  const sku = raw.trim();
  // ponytail: muat katalog penuh per scan barcode (sekali per barang); cache kalau terasa lambat.
  const [cat, tags] = await Promise.all([buildCatalog(null), prisma.rfidTag.count({ where: { sku } })]);
  const it = cat.items.find((x) => x.key === sku.toLowerCase());
  return {
    sku: it?.sku ?? sku,
    name: it?.name ?? null,
    variant: it?.variant ?? null,
    image: it?.img ?? null,
    tags,
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
  const added = list.filter((e) => !owner.has(e) || (move && owner.get(e) !== sku));
  const other = move ? [] : cur.filter((t) => t.sku !== sku).map((t) => ({ epc: t.epc, sku: t.sku }));
  await prisma.$transaction([
    prisma.rfidTag.deleteMany({ where: { epc: { in: added } } }),
    prisma.rfidTag.createMany({ data: added.map((epc) => ({ epc, sku, userId: ctx.userId })) }),
  ]);
  return { added, already: cur.filter((t) => t.sku === sku).length, other, tags: await prisma.rfidTag.count({ where: { sku } }) };
}

/** Batalkan tag yang baru dipasang (salah sapu / ikut terbaca dari barang lain). */
export async function unpairTags(epcs: string[], rawSku: string): Promise<{ tags: number }> {
  await requireChannel();
  const sku = rawSku.trim();
  await prisma.rfidTag.deleteMany({ where: { epc: { in: clean(epcs) }, sku } });
  return { tags: await prisma.rfidTag.count({ where: { sku } }) };
}

/** Tag-tag ini milik SKU apa (sapu tanpa pilih SKU). */
export async function whoseTags(epcs: string[]): Promise<{ sku: string; n: number }[]> {
  await requireChannel();
  const list = clean(epcs);
  const rows = await prisma.rfidTag.groupBy({ by: ["sku"], where: { epc: { in: list } }, _count: true });
  const known = rows.reduce((n, r) => n + r._count, 0);
  return [...rows.map((r) => ({ sku: r.sku, n: r._count })), ...(list.length > known ? [{ sku: "", n: list.length - known }] : [])];
}
