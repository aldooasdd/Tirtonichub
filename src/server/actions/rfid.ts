"use server";

// Pasangkan Tag (Tirtonic Channel): scan barcode SKU → muncul baris sebanyak stok → sapu stiker, baris terisi → Simpan. Reader HC-YK947 mode keyboard: tiap tag = kode + Enter.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { buildCatalog, tokoGudang } from "@/server/pos-catalog";
import { productKey } from "@/server/marketplace/product-groups";
import { setBranchStock } from "@/server/pos-stock";
import { freeSku } from "@/server/sku-unique";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";

export type SkuInfo = {
  sku: string; name: string | null; variant: string | null; image: string | null;
  tagList: Tag[]; stock: number | null; stocks: { label: string; stock: number; branchId: string | null }[];
  cabang: { id: string; label: string; stock: number | null; bisa: boolean }[]; // bisa = punya gudang marketplace, stoknya bisa diubah
};
export type Tag = { epc: string; branchId: string | null };
export type BatchRes = { tagList: Tag[]; other: { epc: string; name: string }[] }; // name = nama barang pemilik tag

const clean = (list: string[]) => [...new Set(list.map((e) => e.trim().toUpperCase()).filter(Boolean))];

const same = (sku: string) => ({ equals: sku, mode: "insensitive" as const });
const tagsOf = (sku: string): Promise<Tag[]> => prisma.rfidTag.findMany({ where: { sku: same(sku) }, orderBy: { createdAt: "asc" }, select: { epc: true, branchId: true } });

/** Nama barang (+ varian) per SKU (huruf kecil), untuk pemberitahuan. SKU tak terdaftar tidak ada di hasil. */
async function namaSku(skus: string[]) {
  const list = [...new Set(skus.map((s) => s.toLowerCase()))];
  const out = new Map<string, string>();
  if (!list.length) return out;
  const items = await prisma.marketplaceItem.findMany({
    where: { deletedAt: null, shopId: { not: "demo" }, OR: list.flatMap((s) => [{ localSku: same(s) }, { localSku: null, sku: same(s) }]) },
    select: { name: true, localName: true, variant: true, sku: true, localSku: true },
    orderBy: { name: "asc" },
  });
  for (const i of items) {
    const k = skuOf(i).toLowerCase();
    const n = i.localName ?? i.name;
    if (!out.has(k)) out.set(k, i.variant && !n.includes(i.variant) ? `${n} · ${i.variant}` : n);
  }
  return out;
}
const label = (nama: Map<string, string>, sku: string) => nama.get(sku.trim().toLowerCase()) ?? `SKU ${sku} (tidak ada di Produk Master)`;

/** Barang + stok sistem (per cabang, sama seperti Produk Quantity) + tag yang sudah terpasang. */
export async function lookupSku(raw: string): Promise<SkuInfo> {
  await requireChannel();
  const sku = raw.trim();
  const toko = await tokoGudang();
  // ponytail: muat katalog penuh per scan barcode (sekali per barang); cache kalau terasa lambat.
  const [cat, tagList] = await Promise.all([buildCatalog(null, toko), tagsOf(sku)]);
  const it = cat.items.find((x) => x.key === sku.toLowerCase());
  return {
    sku: it?.sku ?? sku,
    name: it?.name ?? null,
    variant: it?.variant ?? null,
    image: it?.img ?? null,
    tagList,
    stock: it ? it.stock : null,
    stocks: it?.stocks.map((s) => ({ label: s.label, stock: s.stock, branchId: s.branchId })) ?? [],
    cabang: toko.map((t) => ({ id: t.id, label: t.label, stock: it?.stocks.length ? (it.stocks.find((s) => s.branchId === t.id)?.stock ?? 0) : null, bisa: t.keys.length > 0 })),
  };
}

/** Pasang banyak tag sekaligus ke 1 SKU di 1 cabang. Tag milik SKU/cabang lain tidak dipindah kecuali move=true; tag SKU ini yang belum ada cabang langsung diisi. */
export async function pairTags(epcs: string[], rawSku: string, branchId: string, move = false): Promise<BatchRes> {
  const ctx = await requireChannel();
  const sku = rawSku.trim();
  const list = clean(epcs);
  const toko = await prisma.branch.findMany({ select: { id: true, name: true } });
  if (!toko.some((b) => b.id === branchId)) throw new Error("Cabang tidak ditemukan.");
  const cur = await prisma.rfidTag.findMany({ where: { epc: { in: list } } });
  const owner = new Map(cur.map((t) => [t.epc, t]));
  const skuIni = (t: { sku: string }) => t.sku.toLowerCase() === sku.toLowerCase();
  const pas = (t: { sku: string; branchId: string | null }) => skuIni(t) && t.branchId === branchId;
  const bebas = (t: { sku: string; branchId: string | null }) => skuIni(t) && !t.branchId;
  const added = list.filter((e) => {
    const t = owner.get(e);
    return !t || (!pas(t) && (move || bebas(t)));
  });
  const lain = move ? [] : cur.filter((t) => !pas(t) && !bebas(t));
  const nama = await namaSku(lain.map((t) => t.sku));
  const other = lain.map((t) => ({ epc: t.epc, name: `${label(nama, t.sku)}${skuIni(t) ? ` (${toko.find((b) => b.id === t.branchId)?.name ?? "cabang lain"})` : ""}` }));
  await prisma.$transaction([
    prisma.rfidTag.deleteMany({ where: { epc: { in: added } } }),
    prisma.rfidTag.createMany({ data: added.map((epc) => ({ epc, sku, branchId, userId: ctx.userId })) }),
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
export async function ownersOf(epcs: string[]): Promise<{ epc: string; name: string }[]> {
  await requireChannel();
  const tags = await prisma.rfidTag.findMany({ where: { epc: { in: clean(epcs) } }, select: { epc: true, sku: true } });
  const nama = await namaSku(tags.map((t) => t.sku));
  return tags.map((t) => ({ epc: t.epc, name: label(nama, t.sku) }));
}

export type Barang = { id: string; name: string; variant: string | null; image: string | null; skus: string[]; shops: string[] };
const TOKO: Record<string, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };

/** Varian sama di Shopee/Tokopedia/Tirtonic.com = 1 barang (nama + varian sama, seperti Cek SKU). */
async function semuaBarang() {
  // ponytail: muat semua varian lalu saring di memori; pindah ke query DB kalau terasa lambat.
  const items = await prisma.marketplaceItem.findMany({
    where: { deletedAt: null, shopId: { not: "demo" } },
    select: { id: true, platform: true, name: true, localName: true, variant: true, image: true, sku: true, localSku: true },
    orderBy: { name: "asc" },
  });
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const n = it.localName ?? it.name;
    const k = productKey(it.variant && !n.includes(it.variant) ? `${n} ${it.variant}` : n) || it.id;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(it);
  }
  return [...groups.values()];
}
const skuOf = (it: { sku: string | null; localSku: string | null }) => (it.localSku ?? it.sku ?? "").trim();

/** Cari barang untuk dipasangi SKU baru. Semua kata harus cocok (nama, varian, atau SKU lama). */
export async function cariBarang(raw: string): Promise<Barang[]> {
  await requireChannel();
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return (await semuaBarang())
    .filter((g) => {
      const t = g.map((i) => `${i.localName ?? ""} ${i.name} ${i.variant ?? ""} ${skuOf(i)}`).join(" ").toLowerCase();
      return words.every((w) => t.includes(w));
    })
    .slice(0, 50)
    .map((g) => ({
      id: g[0].id,
      name: g[0].localName ?? g[0].name,
      variant: g[0].variant,
      image: g.find((i) => i.image)?.image ?? null,
      skus: [...new Set(g.map(skuOf).filter(Boolean))],
      shops: [...new Set(g.map((i) => TOKO[i.platform] ?? i.platform))],
    }));
}

/** Barang yang sekarang memakai SKU ini (Edit barang di Pasangkan Tag). */
export async function pemakaiSku(rawSku: string): Promise<string[]> {
  await requireChannel();
  const s = rawSku.trim().toLowerCase();
  return (await semuaBarang()).flat().filter((i) => skuOf(i).toLowerCase() === s).map((i) => `${i.localName ?? i.name}${i.variant ? ` · ${i.variant}` : ""} (${TOKO[i.platform] ?? i.platform})`);
}

/** SKU hasil scan → jadi SKU barang ini di semua toko (Tirtonichub saja, belum dikirim ke marketplace).
 *  edit = barang yang muncul salah: barang lain yang memakai SKU ini dikosongkan SKU-nya. */
export async function gantiSku(itemId: string, rawSku: string, edit = false): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireChannel();
  const sku = rawSku.trim();
  if (!sku || /\s/.test(sku) || sku.length > 50) return { ok: false, message: "SKU tidak boleh kosong, berspasi, atau lebih dari 50 huruf." };
  const g = (await semuaBarang()).find((x) => x.some((i) => i.id === itemId));
  if (!g) return { ok: false, message: "Barang tidak ditemukan. Cari ulang." };
  const ids = g.map((i) => i.id);
  if (!edit) {
    const { clash } = await freeSku(ids, sku);
    if (clash) return { ok: false, message: clash };
  }
  const lama = [...new Set(g.map(skuOf).filter((s) => s && s.toLowerCase() !== sku.toLowerCase()))];
  let tags = 0;
  let kosong: string[] = [];
  await prisma.$transaction(async (tx) => {
    if (edit) {
      const salah = await tx.marketplaceItem.findMany({
        where: { id: { notIn: ids }, deletedAt: null, shopId: { not: "demo" }, OR: [{ localSku: same(sku) }, { localSku: null, sku: same(sku) }] },
        select: { id: true },
      });
      kosong = salah.map((i) => i.id);
      // "" (bukan null): null berarti kembali ke SKU marketplace, yang bisa jadi SKU salah ini juga.
      await tx.marketplaceItem.updateMany({ where: { id: { in: kosong } }, data: { localSku: "" } });
      await tx.skuCheck.updateMany({ where: { itemId: { in: kosong } }, data: { status: "nosku", sku: null, checkedById: ctx.userId, checkedAt: new Date(), pushedAt: null } });
    }
    await tx.marketplaceItem.updateMany({ where: { id: { in: ids } }, data: { localSku: sku } });
    // Keluar dari antrian Cek SKU supaya saran lama tidak menimpa SKU hasil scan.
    await tx.skuCheck.updateMany({ where: { itemId: { in: ids } }, data: { status: "done", sku, checkedById: ctx.userId, checkedAt: new Date(), pushedAt: null } });
    // Tag di SKU lama ikut pindah, kecuali SKU lama masih dipakai barang lain.
    for (const s of lama) {
      const masih = await tx.marketplaceItem.count({ where: { deletedAt: null, OR: [{ localSku: same(s) }, { localSku: null, sku: same(s) }] } });
      if (!masih) tags += (await tx.rfidTag.updateMany({ where: { sku: same(s) }, data: { sku } })).count;
    }
  });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "rfid_ganti_sku", entity: "MarketplaceItem", entityId: itemId, before: { skus: lama }, after: { sku, ids, tags, kosong } });
  revalidatePath("/channel/produk");
  return { ok: true, message: `SKU ${lama.length ? `${lama.join(", ")} diganti jadi ${sku}` : `${sku} tersimpan`}.${tags ? ` ${tags} tag lama ikut pindah.` : ""}${kosong.length ? ` SKU di ${kosong.length} listing barang yang salah dikosongkan.` : ""}` };
}

/** Edit stok per cabang → langsung ke Shopee & Tokopedia (tirtonic.com menyusul lewat sinkron stok). */
export async function simpanStok(rawSku: string, changes: { branchId: string; stock: number }[]): Promise<{ ok: boolean; message: string }> {
  const ctx = await requireChannel();
  const sku = rawSku.trim();
  if (!sku || !changes.length) return { ok: false, message: "Tidak ada stok yang diubah." };
  if (changes.some((c) => !Number.isInteger(c.stock) || c.stock < 0 || c.stock > 9999)) return { ok: false, message: "Stok harus angka bulat 0–9999." };
  const toko = await tokoGudang();
  const results: Awaited<ReturnType<typeof setBranchStock>> = [];
  const gagal: string[] = [];
  for (const c of changes) {
    const t = toko.find((x) => x.id === c.branchId);
    const r = t ? await setBranchStock(sku, t.keys, c.stock) : [];
    if (!r.length) gagal.push(`${t?.label ?? "Cabang"}: tidak ada listing Shopee/Tokopedia dengan gudang cabang ini`);
    gagal.push(...r.filter((x) => x.error).map((x) => `${t?.label} ${TOKO[x.platform]}: ${x.error}`));
    results.push(...r);
  }
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "rfid_stok", entity: "MarketplaceItem", entityId: sku, after: { changes, results } });
  revalidatePath("/channel/produk");
  const base = `Stok tersimpan (${results.filter((r) => !r.error).length} perubahan listing).`;
  return { ok: !gagal.length, message: gagal.length ? `${base} Gagal ${gagal.length}: ${gagal.join(" · ")}` : base };
}
