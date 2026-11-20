// Rule: 1 SKU = 1 varian per toko. Toko lain boleh pakai SKU yang sama (barang fisik sama di Shopee/Tokopedia/Tirtonic.com).
import { prisma } from "@/server/db";

const TOKO: Record<string, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };

/** SKU baru per varian → Map id → alasan bentrok. Kosong = tidak ada bentrok. Huruf besar-kecil dianggap sama. */
export async function skuConflicts(lines: { id: string; sku: string }[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const want = lines.filter((l) => l.sku.trim());
  if (!want.length) return out;
  const ids = want.map((l) => l.id);
  const mine = await prisma.marketplaceItem.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, platform: true } });
  const plat = new Map(mine.map((m) => [m.id, m.platform]));
  const skus = [...new Set(want.map((l) => l.sku.trim()))];
  // ponytail: cari pakai beberapa ejaan (asli/UPPER/lower); campuran huruf aneh lolos. SKU kita mayoritas angka barcode.
  const spell = [...new Set(skus.flatMap((s) => [s, s.toUpperCase(), s.toLowerCase()]))];
  const others = await prisma.marketplaceItem.findMany({
    where: { id: { notIn: ids }, deletedAt: null, OR: [{ localSku: { in: spell } }, { localSku: null, sku: { in: spell } }] },
    select: { platform: true, name: true, localName: true, variant: true, sku: true, localSku: true },
  });
  const used = new Map<string, string>(); // platform|sku → nama pemakai
  for (const o of others) used.set(`${o.platform}|${(o.localSku ?? o.sku ?? "").toLowerCase()}`, `${o.localName ?? o.name}${o.variant ? ` · ${o.variant}` : ""}`);
  for (const l of want) {
    const p = plat.get(l.id);
    if (!p) continue;
    const k = `${p}|${l.sku.trim().toLowerCase()}`;
    const who = used.get(k);
    if (who) out.set(l.id, `SKU ${l.sku.trim()} sudah dipakai ${who} (${TOKO[p] ?? p}).`);
    else used.set(k, "varian lain di daftar ini"); // dua baris di 1 toko pakai SKU sama → baris kedua bentrok
  }
  return out;
}

/** SKU bentrok → tambah 1 angka acak di belakang sampai bebas (user 2026-11-20: "biar bisa di save dulu").
 *  clash = alasan bentrok SKU asli (null = SKU asli dipakai apa adanya). */
export async function freeSku(ids: string[], sku: string): Promise<{ sku: string; clash: string | null }> {
  const base = sku.trim();
  const first = [...(await skuConflicts(ids.map((id) => ({ id, sku: base })))).values()][0] ?? null;
  if (!first) return { sku: base, clash: null };
  let s = base;
  // ponytail: tiap putaran +1 angka acak; 1–2 putaran hampir selalu cukup.
  for (let i = 0; i < 20; i++) {
    s += Math.floor(Math.random() * 10);
    if (!(await skuConflicts(ids.map((id) => ({ id, sku: s })))).size) return { sku: s, clash: first };
  }
  throw new Error("SKU pengganti tidak ketemu.");
}
