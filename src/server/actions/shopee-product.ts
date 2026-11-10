"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireProduk } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as sp from "@/server/marketplace/shopee-product";

type Res<T = undefined> = { ok: boolean; message?: string; data?: T };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

async function run<T>(action: string, id: string, after: object, fn: (c: { token: string; shopId: string }) => Promise<T>, okMsg: string, path: string): Promise<Res<T>> {
  const ctx = await requireProduk();
  try {
    const shop = await activeShop("SHOPEE");
    if (!shop || shop.shopId === DEMO) throw new Error("Toko Shopee belum tersambung.");
    const s = await fresh(shop);
    const data = await fn({ token: s.accessToken, shopId: s.shopId });
    const { ip } = await clientMeta();
    await logActivity({ ...ctx, ip }, { action, entity: "ShopeeProduct", entityId: id, after });
    revalidatePath(path);
    return { ok: true, message: okMsg, data };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function replyReview(commentId: string, text: string) {
  const t = text.trim();
  if (!t) return { ok: false, message: "Balasan kosong." };
  return run(
    "shopee_review_reply",
    commentId,
    { text: t },
    async (c) => {
      const fail = await sp.replyReviews(c, [{ id: commentId, text: t.slice(0, 500) }]);
      if (fail.length) throw new Error(fail[0]);
    },
    "Balasan terkirim.",
    "/channel/ulasan",
  );
}

export async function boostItem(itemId: string) {
  return run(
    "shopee_boost",
    itemId,
    {},
    async (c) => {
      const fail = await sp.boost(c, [itemId]);
      if (fail.length) throw new Error(fail[0]);
    },
    "Produk dinaikkan.",
    `/channel/produk/SHOPEE/${itemId}`,
  );
}

export async function unlistItem(itemId: string, off: boolean) {
  return run(
    "shopee_unlist",
    itemId,
    { off },
    async (c) => {
      await sp.unlist(c, itemId, off);
      await prisma.marketplaceItem.updateMany({ where: { platform: "SHOPEE", itemId }, data: { skuStatus: off ? "DEACTIVATED" : "NORMAL" } });
    },
    off ? "Produk diarsipkan di Shopee." : "Produk ditampilkan lagi di Shopee.",
    `/channel/produk/SHOPEE/${itemId}`,
  );
}

export async function deleteShopeeItem(itemId: string) {
  return run("shopee_delete", itemId, {}, (c) => sp.deleteItem(c, itemId), "Produk dihapus dari Shopee.", "/channel/produk");
}

export async function updateShopeeItem(itemId: string, d: { name?: string; description?: string }) {
  return run("shopee_update", itemId, d, (c) => sp.updateItem(c, itemId, d), "Produk Shopee diperbarui.", `/channel/produk/SHOPEE/${itemId}`);
}
