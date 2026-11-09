"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { shopeeAuthUrl } from "@/server/marketplace/shopee";
import { tiktokAuthUrl } from "@/server/marketplace/tiktok";
import { apiReady, clearDemo, isChannel, pushItem, saveShop, startDemo, syncItems, syncOrders, PLATFORM_LABEL } from "@/server/marketplace/sync";
import { WEBSITE_SHOP, websiteShip } from "@/server/marketplace/website";

type Res = { ok: boolean; message?: string; url?: string };
const base = () => (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

/** Link izin toko. State acak disimpan di cookie → dicek di callback (anti CSRF). */
export async function connectShop(platform: string): Promise<Res> {
  await requireChannel();
  if (!isChannel(platform)) return { ok: false, message: "Platform tidak dikenal." };
  if (!apiReady(platform))
    return { ok: false, message: `Kunci API ${PLATFORM_LABEL[platform]} belum diisi di server. Daftar developer dulu, atau coba Mode Contoh.` };
  if (platform === "WEBSITE") {
    // Web toko sendiri: tanpa halaman izin; kunci rahasia antar-server sudah ada di kedua aplikasi.
    await saveShop("WEBSITE", { shopId: WEBSITE_SHOP, shopName: "tirtonic.com", accessToken: "-", refreshToken: "-", expiresAt: new Date("2100-01-01") });
    try {
      const o = await syncOrders("WEBSITE", 30);
      const i = await syncItems("WEBSITE");
      return { ok: true, message: `Tirtonic.com tersambung: ${o.total} pesanan (30 hari), ${i} produk.` };
    } catch (e) {
      return { ok: false, message: `Tersambung, tapi sinkron gagal: ${errMsg(e)}` };
    }
  }
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("mp_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  const cb = `${base()}/api/marketplace/${platform.toLowerCase()}/callback`;
  return { ok: true, url: platform === "SHOPEE" ? shopeeAuthUrl(`${cb}?state=${state}`) : tiktokAuthUrl(state) };
}

export async function disconnectShop(platform: string): Promise<Res> {
  const ctx = await requireChannel();
  if (!isChannel(platform)) return { ok: false, message: "Platform tidak dikenal." };
  await prisma.marketplaceShop.deleteMany({ where: { platform } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "channel_disconnect", entity: "MarketplaceShop", entityId: platform });
  return { ok: true };
}

export async function syncNow(platform: string): Promise<Res> {
  await requireChannel();
  if (!isChannel(platform)) return { ok: false, message: "Platform tidak dikenal." };
  try {
    const o = await syncOrders(platform);
    const i = await syncItems(platform);
    return { ok: true, message: `${PLATFORM_LABEL[platform]}: ${o.total} order dicek (${o.baru} baru), ${i} produk${o.settlement ? `, ${o.settlement}` : ""}.` };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function updateChannelItem(id: string, stock: number, price: number): Promise<Res> {
  const ctx = await requireChannel();
  const it = await prisma.marketplaceItem.findUnique({ where: { id } });
  if (!it) return { ok: false, message: "Produk tidak ditemukan." };
  const s = Math.max(0, Math.round(stock) || 0);
  const p = Math.max(0, Math.round(price) || 0);
  if (p <= 0) return { ok: false, message: "Harga harus lebih dari 0." };
  const change = { ...(s !== it.stock ? { stock: s } : {}), ...(p !== it.price ? { price: p } : {}) };
  if (!Object.keys(change).length) return { ok: true, message: "Tidak ada perubahan." };
  try {
    await pushItem(id, change);
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "channel_item_update", entity: "MarketplaceItem", entityId: id, before: { stock: it.stock, price: it.price }, after: change });
  return { ok: true, message: "Tersimpan di marketplace." };
}

export async function demoOn(): Promise<Res> {
  await requireChannel();
  await startDemo();
  return { ok: true };
}

export async function demoOff(): Promise<Res> {
  await requireChannel();
  await clearDemo();
  return { ok: true };
}

/** Tirtonic.com: isi resi → pesanan web jadi Dikirim (WA resi ke pembeli dikirim oleh tirtonic.com). */
export async function shipWebsiteOrder(id: string, resi: string, kurir: string): Promise<Res> {
  const ctx = await requireChannel();
  const o = await prisma.marketplaceOrder.findUnique({ where: { id } });
  if (!o || o.platform !== "WEBSITE") return { ok: false, message: "Pesanan Tirtonic.com tidak ditemukan." };
  const r = resi.trim();
  if (r.length < 4 || r.length > 50) return { ok: false, message: "Resi 4–50 karakter." };
  try {
    await websiteShip(o.orderSn, r, kurir.trim());
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
  await prisma.marketplaceOrder.update({ where: { id }, data: { trackingNo: r, status: "IN_TRANSIT", ...(kurir.trim() ? { courier: kurir.trim() } : {}) } });
  const { ip } = await clientMeta();
  await logActivity({ ...ctx, ip }, { action: "channel_order_ship", entity: "MarketplaceOrder", entityId: id, after: { resi: r, kurir } });
  return { ok: true, message: "Resi tersimpan di Tirtonic.com." };
}
