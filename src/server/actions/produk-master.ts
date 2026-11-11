"use server";

// Produk Master: edit nama & SKU + Sampah. Semua LOKAL di Tirtonichub — tidak dikirim ke marketplace.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { loadProductGroupOf } from "@/server/marketplace/product-groups";
import { websiteRename } from "@/server/marketplace/website";
import { DEMO, PLATFORM_LABEL, activeShop, fresh } from "@/server/marketplace/sync";
import { updateItem as updateShopeeItem } from "@/server/marketplace/shopee-product";
import { partialEditProduct } from "@/server/marketplace/tiktok-product";
import { bolehUbah } from "@/lib/flags";
import { pushTokopediaToWebCore } from "@/server/marketplace/website-import";

type Res = { ok: boolean; message?: string };

/** Semua baris (varian) dari produk ini + produk bernama sama di toko lain. */
async function groupWhere(platform: string, itemId: string, trash: boolean) {
  const g = await loadProductGroupOf(platform, itemId, trash);
  const ls = g?.listings ?? [{ platform, itemId }];
  return { OR: ls.map((l) => ({ platform: l.platform, itemId: l.itemId })) };
}

async function log(action: string, entityId: string, after: object) {
  const ctx = await requireProduk();
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action, entity: "MarketplaceItem", entityId, after });
}

export async function renameProduct(platform: string, itemId: string, name: string): Promise<Res> {
  await requireProduk();
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 3) return { ok: false, message: "Nama minimal 3 huruf." };
  if (n.length > 255) return { ok: false, message: "Nama maksimal 255 huruf." };
  const where = await groupWhere(platform, itemId, false);
  // Kirim nama ke tiap toko yang boleh diubah (Tirtonic.com / Shopee / Tokopedia sesuai saklar).
  const listings = await prisma.marketplaceItem.findMany({ where: { AND: [where, { shopId: { not: DEMO } }] }, select: { platform: true, itemId: true }, distinct: ["platform", "itemId"] });
  const sent: string[] = [];
  const fail: string[] = [];
  for (const l of listings.filter((x) => bolehUbah(x.platform))) {
    try {
      if (l.platform === "WEBSITE") await websiteRename(l.itemId, n);
      else {
        const shop = await fresh((await activeShop(l.platform as "SHOPEE" | "TOKOPEDIA"))!);
        if (l.platform === "SHOPEE") await updateShopeeItem({ token: shop.accessToken, shopId: shop.shopId }, l.itemId, { name: n });
        else await partialEditProduct({ token: shop.accessToken, cipher: shop.cipher ?? "" }, l.itemId, { title: n });
      }
      sent.push(PLATFORM_LABEL[l.platform as keyof typeof PLATFORM_LABEL] ?? l.platform);
    } catch (e) {
      fail.push(`${PLATFORM_LABEL[l.platform as keyof typeof PLATFORM_LABEL] ?? l.platform}: ${e instanceof Error ? e.message : "gagal"}`);
    }
  }
  await prisma.marketplaceItem.updateMany({ where, data: { localName: n } });
  await log("produk_rename", `${platform}:${itemId}`, { name: n, sent, fail });
  revalidatePath("/channel/produk");
  if (fail.length) return { ok: false, message: `Nama tersimpan${sent.length ? `, terkirim ke ${sent.join(", ")}` : ""}. Gagal: ${fail.join(" · ")}` };
  return { ok: true, message: sent.length ? `Nama tersimpan & ikut diubah di ${sent.join(", ")}.` : "Nama tersimpan." };
}

export async function setItemSku(id: string, sku: string): Promise<Res> {
  await requireProduk();
  const it = await prisma.marketplaceItem.findUnique({ where: { id } });
  if (!it) return { ok: false, message: "Varian tidak ditemukan." };
  const s = sku.trim().slice(0, 100);
  // Kosong / sama dengan SKU marketplace → kembali pakai SKU asli.
  const localSku = !s || s === it.sku ? null : s;
  await prisma.marketplaceItem.update({ where: { id }, data: { localSku } });
  await log("produk_sku", id, { sku: localSku ?? it.sku });
  return { ok: true, message: "SKU tersimpan." };
}

export async function trashProduct(platform: string, itemId: string): Promise<Res> {
  await requireProduk();
  const where = await groupWhere(platform, itemId, false);
  await prisma.marketplaceItem.updateMany({ where, data: { deletedAt: new Date() } });
  await log("produk_trash", `${platform}:${itemId}`, {});
  revalidatePath("/channel/produk");
  return { ok: true, message: "Produk dipindah ke Sampah." };
}

/** Hapus 1 varian dobel dari Tirtonichub saja (marketplace tak diubah). Sync tak memulihkan; pulihkan lewat Sampah. */
export async function trashVariant(id: string): Promise<Res> {
  await requireProduk();
  const it = await prisma.marketplaceItem.update({ where: { id }, data: { deletedAt: new Date() } }).catch(() => null);
  if (!it) return { ok: false, message: "Varian tidak ditemukan." };
  await log("produk_trash_varian", id, { platform: it.platform, itemId: it.itemId, variant: it.variant ?? it.name });
  revalidatePath("/channel/produk");
  return { ok: true, message: "Varian dipindah ke Sampah." };
}

/** Hapus semua varian 1 listing (mis. listing lama dobel) dari Tirtonichub saja. Pulihkan lewat Sampah. */
export async function trashListing(platform: string, itemId: string): Promise<Res> {
  await requireProduk();
  const { count } = await prisma.marketplaceItem.updateMany({ where: { platform, itemId, deletedAt: null }, data: { deletedAt: new Date() } });
  await log("produk_trash_listing", `${platform}:${itemId}`, { count });
  revalidatePath("/channel/produk");
  return { ok: true, message: `${count} varian dipindah ke Sampah.` };
}

export async function restoreProduct(platform: string, itemId: string): Promise<Res> {
  await requireProduk();
  const where = await groupWhere(platform, itemId, true);
  await prisma.marketplaceItem.updateMany({ where, data: { deletedAt: null } });
  await log("produk_restore", `${platform}:${itemId}`, {});
  revalidatePath("/channel/produk");
  return { ok: true, message: "Produk dipulihkan." };
}

/** Tombol "Export ke Web" per produk di Produk Master: kirim 1 produk Tokopedia ke tirtonic.com. */
export async function pushProductToWeb(itemId: string): Promise<Res> {
  await requireProduk();
  const r = await pushTokopediaToWebCore([itemId]);
  if (r.total === 0) return { ok: false, message: "Produk Tokopedia tidak ditemukan / nonaktif." };
  if (r.total > 0) await log("produk_ke_web", `TOKOPEDIA:${itemId}`, { created: r.created, updated: r.updated });
  revalidatePath("/channel/produk");
  if (r.failed.length) return { ok: false, message: r.failed[0] };
  return { ok: true, message: r.created ? "Masuk ke web." : "Diperbarui di web (ditimpa)." };
}
