"use server";

// Produk Master: edit nama & SKU + Sampah. Semua LOKAL di Tirtonichub — tidak dikirim ke marketplace.
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { loadProductGroupOf } from "@/server/marketplace/product-groups";

type Res = { ok: boolean; message?: string };

/** Semua baris (varian) dari produk ini + produk bernama sama di toko lain. */
async function groupWhere(platform: string, itemId: string, trash: boolean) {
  const g = await loadProductGroupOf(platform, itemId, trash);
  const ls = g?.listings ?? [{ platform, itemId }];
  return { OR: ls.map((l) => ({ platform: l.platform, itemId: l.itemId })) };
}

async function log(action: string, entityId: string, after: object) {
  const ctx = await requireChannel();
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action, entity: "MarketplaceItem", entityId, after });
}

export async function renameProduct(platform: string, itemId: string, name: string): Promise<Res> {
  await requireChannel();
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 3) return { ok: false, message: "Nama minimal 3 huruf." };
  if (n.length > 255) return { ok: false, message: "Nama maksimal 255 huruf." };
  const where = await groupWhere(platform, itemId, false);
  await prisma.marketplaceItem.updateMany({ where, data: { localName: n } });
  await log("produk_rename", `${platform}:${itemId}`, { name: n });
  revalidatePath("/channel/produk");
  return { ok: true, message: "Nama tersimpan (hanya di Tirtonichub)." };
}

export async function setItemSku(id: string, sku: string): Promise<Res> {
  await requireChannel();
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
  await requireChannel();
  const where = await groupWhere(platform, itemId, false);
  await prisma.marketplaceItem.updateMany({ where, data: { deletedAt: new Date() } });
  await log("produk_trash", `${platform}:${itemId}`, {});
  revalidatePath("/channel/produk");
  return { ok: true, message: "Produk dipindah ke Sampah." };
}

export async function restoreProduct(platform: string, itemId: string): Promise<Res> {
  await requireChannel();
  const where = await groupWhere(platform, itemId, true);
  await prisma.marketplaceItem.updateMany({ where, data: { deletedAt: null } });
  await log("produk_restore", `${platform}:${itemId}`, {});
  revalidatePath("/channel/produk");
  return { ok: true, message: "Produk dipulihkan." };
}
