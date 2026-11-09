"use server";

import { requireOnlineSales } from "@/server/auth/rbac";
import { prisma } from "@/server/db";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { DEMO, PLATFORMS, activeShop, isPlatform, mustShop, type Marketplace as Platform } from "@/server/marketplace/sync";
import * as shopee from "@/server/marketplace/shopee";
import * as tiktok from "@/server/marketplace/tiktok";
import type { MpConv, MpMsg } from "@/server/marketplace/shopee";

export type ChatConv = MpConv & { platform: Platform };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

/** Daftar chat semua toko tersambung, terbaru di atas. Error per toko dikembalikan, tidak menggagalkan yang lain. */
export async function listChats(): Promise<{ convs: ChatConv[]; errors: string[] }> {
  await requireOnlineSales();
  const convs: ChatConv[] = [];
  const errors: string[] = [];
  for (const p of PLATFORMS) {
    const s = await activeShop(p);
    if (!s || s.shopId === DEMO) continue;
    try {
      const shop = await mustShop(p);
      const list = p === "SHOPEE" ? await shopee.shopeeConversations(shop.accessToken, shop.shopId) : await tiktok.tiktokConversations(shop.accessToken, shop.cipher ?? "");
      convs.push(...list.map((c) => ({ ...c, platform: p })));
    } catch (e) {
      errors.push(errMsg(e));
    }
  }
  convs.sort((a, b) => b.at - a.at);
  return { convs, errors };
}

export async function chatMessages(platform: string, convId: string): Promise<{ ok: boolean; messages?: MpMsg[]; message?: string }> {
  await requireOnlineSales();
  if (!isPlatform(platform) || !convId) return { ok: false, message: "Chat tidak dikenal." };
  try {
    const shop = await mustShop(platform);
    const messages =
      platform === "SHOPEE" ? await shopee.shopeeMessages(shop.accessToken, shop.shopId, convId) : await tiktok.tiktokMessages(shop.accessToken, shop.cipher ?? "", convId);
    return { ok: true, messages };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function sendChat(platform: string, convId: string, toId: string, text: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireOnlineSales();
  const body = text.trim().slice(0, 1000);
  if (!isPlatform(platform) || !convId || !body) return { ok: false, message: "Pesan kosong." };
  try {
    const shop = await mustShop(platform);
    if (platform === "SHOPEE") await shopee.shopeeSendText(shop.accessToken, shop.shopId, toId, body);
    else await tiktok.tiktokSendText(shop.accessToken, shop.cipher ?? "", convId, body);
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: "marketplace_chat_send", entity: "MarketplaceChat", entityId: `${platform}:${convId}` });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

// --- Kirim kartu & gambar (Tokopedia/TikTok) ---

async function ttShop() {
  const shop = await mustShop("TOKOPEDIA");
  return { token: shop.accessToken, cipher: shop.cipher ?? "" };
}

/** Kirim kartu produk / pesanan ke pembeli Tokopedia. */
export async function sendChatCard(platform: string, convId: string, kind: "PRODUCT_CARD" | "ORDER_CARD", id: string): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireOnlineSales();
  if (platform !== "TOKOPEDIA") return { ok: false, message: "Kartu hanya untuk Tokopedia." };
  if (!convId || !/^\d+$/.test(id)) return { ok: false, message: "Data kartu tidak valid." };
  try {
    const { token, cipher } = await ttShop();
    await tiktok.tiktokSend(token, cipher, convId, kind, kind === "PRODUCT_CARD" ? { product_id: id } : { order_id: id });
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: "marketplace_chat_card", entity: "MarketplaceChat", entityId: `${platform}:${convId}`, after: { kind, id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

/** Upload & kirim gambar (jpg/png/webp/gif, maks 10MB) ke pembeli Tokopedia. */
export async function sendChatImage(fd: FormData): Promise<{ ok: boolean; message?: string }> {
  const ctx = await requireOnlineSales();
  const platform = String(fd.get("platform") ?? "");
  const convId = String(fd.get("convId") ?? "");
  const file = fd.get("file");
  if (platform !== "TOKOPEDIA") return { ok: false, message: "Kirim gambar baru tersedia untuk Tokopedia." };
  if (!convId || !(file instanceof File)) return { ok: false, message: "Pilih gambar dulu." };
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return { ok: false, message: "Format gambar harus JPG, PNG, WEBP, atau GIF." };
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Gambar maksimal 10MB." };
  try {
    const { token, cipher } = await ttShop();
    const img = await tiktok.tiktokUploadChatImage(token, cipher, file, file.name || "gambar.jpg");
    await tiktok.tiktokSend(token, cipher, convId, "IMAGE", { url: img.url, width: img.width, height: img.height });
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action: "marketplace_chat_image", entity: "MarketplaceChat", entityId: `${platform}:${convId}` });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

/** Pilihan produk Tokopedia untuk kartu produk (dari data sinkron). */
export async function chatPickProducts(q: string): Promise<{ id: string; name: string; price: number; stock: number }[]> {
  await requireOnlineSales();
  const rows = await prisma.marketplaceItem.findMany({
    where: { platform: "TOKOPEDIA", shopId: { not: DEMO }, ...(q.trim() ? { name: { contains: q.trim(), mode: "insensitive" } } : {}) },
    orderBy: { name: "asc" },
    take: 30,
    select: { itemId: true, name: true, price: true, stock: true },
  });
  // 1 produk bisa banyak varian → tampilkan sekali per produk.
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.itemId) && seen.add(r.itemId)).map((r) => ({ id: r.itemId, name: r.name, price: r.price, stock: r.stock }));
}

/** Pilihan pesanan Tokopedia untuk kartu pesanan (cari no. pesanan / nama penerima). */
export async function chatPickOrders(q: string): Promise<{ id: string; who: string; total: number; status: string; at: number }[]> {
  await requireOnlineSales();
  const k = q.trim();
  const rows = await prisma.marketplaceOrder.findMany({
    where: {
      platform: "TOKOPEDIA",
      shopId: { not: DEMO },
      ...(k ? { OR: [{ orderSn: { contains: k } }, { recipient: { contains: k, mode: "insensitive" } }, { buyer: { contains: k, mode: "insensitive" } }] } : {}),
    },
    orderBy: { orderedAt: "desc" },
    take: 20,
    select: { orderSn: true, recipient: true, buyer: true, total: true, status: true, orderedAt: true },
  });
  return rows.map((r) => ({ id: r.orderSn, who: r.recipient || r.buyer || "-", total: r.total, status: r.status, at: r.orderedAt.getTime() }));
}

// --- Template balasan cepat ---

export type ChatTpl = { id: string; shortcut: string; text: string; grup: string };

export async function listTemplates(): Promise<ChatTpl[]> {
  await requireOnlineSales();
  return prisma.chatTemplate.findMany({ orderBy: [{ grup: "asc" }, { shortcut: "asc" }], select: { id: true, shortcut: true, text: true, grup: true } });
}

export async function saveTemplate(t: { id?: string; shortcut: string; text: string; grup: string }): Promise<{ ok: boolean; message?: string }> {
  await requireOnlineSales();
  const shortcut = t.shortcut.trim().replace(/^\//, "").toLowerCase().slice(0, 30);
  const text = t.text.trim().slice(0, 2000);
  const grup = t.grup.trim().slice(0, 30) || "tirtonic";
  if (!/^[a-z0-9_-]+$/.test(shortcut)) return { ok: false, message: "Shortcut hanya huruf kecil, angka, - atau _ (tanpa spasi)." };
  if (!text) return { ok: false, message: "Isi template kosong." };
  const dup = await prisma.chatTemplate.findUnique({ where: { shortcut }, select: { id: true } });
  if (dup && dup.id !== t.id) return { ok: false, message: `/${shortcut} sudah dipakai.` };
  if (t.id) await prisma.chatTemplate.update({ where: { id: t.id }, data: { shortcut, text, grup } });
  else await prisma.chatTemplate.create({ data: { shortcut, text, grup } });
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<{ ok: boolean }> {
  await requireOnlineSales();
  await prisma.chatTemplate.deleteMany({ where: { id } });
  return { ok: true };
}
