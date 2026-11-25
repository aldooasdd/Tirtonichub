// Data Tag: semua stiker RFID terpasang, digabung per SKU dengan detail barang & stok sistem.
import { prisma } from "@/server/db";
import { buildCatalog } from "@/server/pos-catalog";

export type TagSku = {
  key: string; sku: string; name: string | null; variant: string | null; image: string | null; price: number | null;
  stock: number | null; stocks: { label: string; stock: number }[];
  tags: { epc: string; at: Date; by: string | null }[]; // terbaru dulu
};
export type TagFilter = { q?: string; st?: string };

/** selisih tag − stok; null = barang tidak ada di Produk Master. */
export const selisih = (r: TagSku) => (r.stock == null ? null : r.tags.length - r.stock);

export async function loadTagData(f: TagFilter): Promise<{ all: TagSku[]; rows: TagSku[] }> {
  const [tags, cat] = await Promise.all([prisma.rfidTag.findMany({ orderBy: { updatedAt: "desc" } }), buildCatalog(null)]);
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(tags.map((t) => t.userId).filter((x): x is string => !!x))] } },
    select: { id: true, fullName: true, nickname: true },
  });
  const by = new Map(users.map((u) => [u.id, u.nickname || u.fullName]));
  const item = new Map(cat.items.map((i) => [i.key, i]));
  const map = new Map<string, TagSku>();
  for (const t of tags) {
    const key = t.sku.trim().toLowerCase();
    let r = map.get(key);
    if (!r) {
      const it = item.get(key);
      r = { key, sku: it?.sku ?? t.sku, name: it?.name ?? null, variant: it?.variant ?? null, image: it?.img ?? null, price: it?.price ?? null, stock: it?.stock ?? null, stocks: it?.stocks.map((s) => ({ label: s.label, stock: s.stock })) ?? [], tags: [] };
      map.set(key, r);
    }
    r.tags.push({ epc: t.epc, at: t.updatedAt, by: t.userId ? (by.get(t.userId) ?? null) : null });
  }
  const all = [...map.values()]; // urut: tag terbaru dulu
  const q = (f.q ?? "").trim().toLowerCase();
  const rows = all.filter((r) => {
    const d = selisih(r);
    if (f.st === "cocok" && d !== 0) return false;
    if (f.st === "kurang" && !(d != null && d < 0)) return false;
    if (f.st === "lebih" && !(d != null && d > 0)) return false;
    if (f.st === "asing" && d != null) return false;
    return !q || r.key.includes(q) || `${r.name ?? ""} ${r.variant ?? ""}`.toLowerCase().includes(q) || r.tags.some((t) => t.epc.toLowerCase().includes(q));
  });
  return { all, rows };
}
