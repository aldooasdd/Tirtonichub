"use server";

import { requireOnlineSales } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { DEMO, PLATFORMS, activeShop, isPlatform, mustShop, type Platform } from "@/server/marketplace/sync";
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
