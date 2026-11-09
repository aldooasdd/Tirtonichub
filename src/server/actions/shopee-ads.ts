"use server";

// Ubah iklan Shopee dari dashboard. Semua butuh role Channel; dicatat di log aktivitas.
import { revalidatePath } from "next/cache";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as ads from "@/server/marketplace/shopee-ads";

type Res<T = undefined> = { ok: boolean; message?: string; data?: T };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");
/** "YYYY-MM-DD" → "DD-MM-YYYY". */
const sd = (iso?: string) => (iso ? iso.split("-").reverse().join("-") : undefined);

async function run<T>(action: string, entityId: string, after: object, fn: (c: { token: string; shopId: string }) => Promise<T>, okMsg: string): Promise<Res<T>> {
  const ctx = await requireChannel();
  try {
    const shop = await activeShop("SHOPEE");
    if (!shop || shop.shopId === DEMO) throw new Error("Toko Shopee belum tersambung.");
    const s = await fresh(shop);
    const data = await fn({ token: s.accessToken, shopId: s.shopId });
    if (action) {
      const { ip } = await clientMeta();
      await logActivity({ ...ctx, ip }, { action, entity: "ShopeeAds", entityId, after });
      revalidatePath("/channel/iklan");
    }
    return { ok: true, message: okMsg, data };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

const pos = (n: number | undefined, label: string) => {
  if (n != null && !(n > 0)) throw new Error(`${label} harus lebih dari 0.`);
};

export async function adEdit(campaignId: string, action: ads.AdEdit, d: { budget?: number; start?: string; end?: string; roasTarget?: number } = {}) {
  return run(
    "shopee_ads_edit",
    campaignId,
    { action, ...d },
    (c) => {
      if (action === "change_budget") pos(d.budget, "Budget");
      return ads.editProductAd(c, campaignId, action, { ...d, start: sd(d.start), end: sd(d.end) });
    },
    "Iklan diperbarui.",
  );
}

export async function adKeywords(campaignId: string, edits: ads.KeywordEdit[]) {
  return run("shopee_ads_keywords", campaignId, { edits }, (c) => ads.editKeywords(c, campaignId, edits), "Keyword diperbarui.");
}

export async function adCreate(d: { itemId: string; budget: number; start: string; end?: string; bidding: "auto" | "manual"; roasTarget?: number; keywords?: ads.NewAd["keywords"] }) {
  return run(
    "shopee_ads_create",
    d.itemId,
    d,
    (c) => {
      pos(d.budget, "Budget");
      if (!d.itemId) throw new Error("Pilih produk.");
      if (d.bidding === "manual" && !d.keywords?.length) throw new Error("Iklan manual butuh minimal 1 keyword.");
      return ads.createProductAd(c, { ...d, start: sd(d.start)!, end: sd(d.end) });
    },
    "Iklan dibuat.",
  );
}

export async function gmsCreate(d: { start: string; end?: string; dailyBudget: number; roasTarget?: number }) {
  return run(
    "shopee_gms_create",
    "gms",
    d,
    (c) => {
      pos(d.dailyBudget, "Budget harian");
      return ads.createGms(c, { ...d, start: sd(d.start)!, end: sd(d.end) });
    },
    "Iklan GMV Max dibuat.",
  );
}

export async function gmsEdit(campaignId: string, action: ads.GmsEdit, d: { dailyBudget?: number; start?: string; end?: string; roasTarget?: number } = {}) {
  return run("shopee_gms_edit", campaignId, { action, ...d }, (c) => ads.editGms(c, campaignId, action, { ...d, start: sd(d.start), end: sd(d.end) }), "GMV Max diperbarui.");
}

// Baca (tanpa log)
export async function suggestKeywords(itemId: string, input = "") {
  return run("", itemId, {}, (c) => ads.recommendedKeywords(c, itemId, input), "");
}
export async function suggestRoas(itemId: string) {
  return run("", itemId, {}, (c) => ads.recommendedRoas(c, itemId), "");
}
export async function suggestBudget(d: { itemId: string; bidding: "auto" | "manual"; placement: "search" | "discovery" | "all"; roasTarget?: number }) {
  return run("", d.itemId, {}, (c) => ads.budgetSuggestion(c, d), "");
}
