"use server";

// Stok per gudang Shopee & Tokopedia: lihat, tambah / kurangi. Marketplace hanya menerima "atur jumlah",
// jadi stok terbaru dibaca dulu, ditambah/dikurangi, lalu jumlah barunya dikirim.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { DEMO, mustShop } from "@/server/marketplace/sync";
import * as shopee from "@/server/marketplace/shopee";
import * as tt from "@/server/marketplace/tiktok-ops";
import { tiktokSetStock } from "@/server/marketplace/tiktok";
import { PRODUK_OFF_MSG, bolehUbah } from "@/lib/flags";

export type GudangRow = { skuId: string; warehouseId: string; warehouse: string; stock: number; reserved: number };
type Res<T = undefined> = { ok: boolean; message?: string; data?: T };
type MP = "SHOPEE" | "TOKOPEDIA";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

async function shopOf(platform: MP) {
  const s = await mustShop(platform);
  if (s.shopId === DEMO) throw new Error("Toko contoh tidak punya gudang.");
  return s;
}

async function read(platform: MP, productId: string): Promise<GudangRow[]> {
  const s = await shopOf(platform);
  if (platform === "SHOPEE") {
    const [rows, names] = await Promise.all([shopee.shopeeLocationStock(s.accessToken, s.shopId, productId), shopee.shopeeWarehouseNames(s.accessToken, s.shopId)]);
    return rows.flatMap((r) =>
      // Multi-gudang: tampilkan juga gudang toko yang belum dipakai varian ini (stok 0) → bisa langsung diisi.
      (r.locations.length ? [...r.locations, ...[...names.keys()].filter((id) => !r.locations.some((l) => l.id === id)).map((id) => ({ id, stock: 0 }))] : [{ id: "", stock: 0 }]).map((l) => ({
        skuId: r.modelId,
        warehouseId: l.id,
        warehouse: names.get(l.id) ?? (l.id || "Gudang utama"),
        stock: l.stock,
        reserved: r.locations.some((x) => x.id === l.id) ? r.reserved : 0,
      })),
    );
  }
  const c = { token: s.accessToken, cipher: s.cipher ?? "" };
  const [inv, whs] = await Promise.all([tt.inventory(c, [productId]), tt.warehouses(c).catch(() => [])]);
  const name = new Map(whs.map((w) => [w.id, w.name]));
  // Gudang jual aktif yang belum dipakai SKU ini → tampil stok 0, bisa diisi.
  const sales = whs.filter((w) => w.type !== "RETURN_WAREHOUSE" && w.status !== "DISABLED");
  return inv.flatMap((k) =>
    (k.warehouses.length
      ? [...k.warehouses, ...sales.filter((w) => !k.warehouses.some((x) => x.id === w.id)).map((w) => ({ id: w.id, available: 0, committed: 0 }))]
      : [{ id: "", available: k.available, committed: k.committed }]
    ).map((w) => ({
      skuId: k.skuId,
      warehouseId: w.id,
      warehouse: name.get(w.id) ?? (w.id || "Gudang utama"),
      stock: w.available,
      reserved: w.committed,
    })),
  );
}

export async function stokGudang(platform: MP, productId: string): Promise<Res<GudangRow[]>> {
  await requireProduk();
  try {
    return { ok: true, data: await read(platform, productId) };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

/** Tambah (delta > 0) / kurangi (delta < 0) stok 1 varian di 1 gudang. */
export async function ubahStokGudang(platform: MP, productId: string, skuId: string, warehouseId: string, delta: number): Promise<Res<GudangRow[]>> {
  const ctx = await requireProduk();
  if (!bolehUbah(platform)) return { ok: false, message: PRODUK_OFF_MSG };
  const d = Math.round(delta);
  if (!d) return { ok: false, message: "Isi jumlah." };
  try {
    const now = (await read(platform, productId)).find((r) => r.skuId === skuId && r.warehouseId === warehouseId);
    if (!now) throw new Error("Varian / gudang tidak ditemukan. Muat ulang.");
    const next = now.stock + d;
    if (next < 0) throw new Error(`Stok di ${now.warehouse} tinggal ${now.stock}, tidak bisa dikurangi ${-d}.`);
    const s = await shopOf(platform);
    if (platform === "SHOPEE") await shopee.shopeeSetLocationStock(s.accessToken, s.shopId, productId, skuId, warehouseId, next);
    else await tiktokSetStock(s.accessToken, s.cipher ?? "", productId, skuId, warehouseId || null, next);
    await prisma.marketplaceItem.updateMany({ where: { platform, itemId: productId, modelId: skuId }, data: { stock: { increment: d } } });
    // Stok per gudang (Produk Quantity & kasir) ikut diperbarui tanpa menunggu sync.
    const it = await prisma.marketplaceItem.findFirst({ where: { platform, itemId: productId, modelId: skuId }, select: { id: true, whStock: true } });
    const wh = (it?.whStock as { id: string; stock: number }[] | null) ?? null;
    if (it && wh?.some((w) => w.id === warehouseId))
      await prisma.marketplaceItem.update({ where: { id: it.id }, data: { whStock: wh.map((w) => (w.id === warehouseId ? { ...w, stock: next } : w)) } });
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: "stok_gudang", entity: "MarketplaceItem", entityId: `${platform}:${productId}:${skuId}`, before: { stock: now.stock }, after: { warehouse: now.warehouse, delta: d, stock: next } });
    revalidatePath(`/channel/produk/${platform}/${productId}`);
    return { ok: true, message: `${now.warehouse}: ${now.stock} → ${next}.`, data: await read(platform, productId) };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}
