"use server";

import { revalidatePath } from "next/cache";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as rt from "@/server/marketplace/shopee-returns";

type Res<T = undefined> = { ok: boolean; message?: string; data?: T };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

async function run<T>(action: string, sn: string, after: object, fn: (c: { token: string; shopId: string }) => Promise<T>, okMsg: string): Promise<Res<T>> {
  const ctx = await requireChannel();
  try {
    const shop = await activeShop("SHOPEE");
    if (!shop || shop.shopId === DEMO) throw new Error("Toko Shopee belum tersambung.");
    const s = await fresh(shop);
    const data = await fn({ token: s.accessToken, shopId: s.shopId });
    if (action) {
      const { ip } = await clientMeta();
      await logActivity({ ...ctx, ip }, { action, entity: "ShopeeReturn", entityId: sn, after });
      revalidatePath(`/channel/retur/${sn}`);
    }
    return { ok: true, message: okMsg, data };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function returnConfirm(sn: string) {
  return run("shopee_return_confirm", sn, {}, (c) => rt.confirmReturn(c, sn).then(() => undefined), "Retur disetujui.");
}
export async function returnAccept(sn: string) {
  return run("shopee_return_accept_offer", sn, {}, (c) => rt.acceptOffer(c, sn).then(() => undefined), "Penawaran pembeli diterima.");
}
export async function returnOffer(sn: string, solution: "return_refund" | "refund", amount?: number) {
  return run("shopee_return_offer", sn, { solution, amount }, (c) => rt.offerReturn(c, sn, solution, amount).then(() => undefined), "Penawaran dikirim.");
}
export async function returnDispute(d: { sn: string; email: string; reasonId: string; text?: string; images?: { index: number; requirement: string; urls: string[] }[] }) {
  return run(
    "shopee_return_dispute",
    d.sn,
    { reasonId: d.reasonId, text: d.text },
    (c) => {
      if (!/^\S+@\S+\.\S+$/.test(d.email)) throw new Error("Email tidak valid.");
      return rt.disputeReturn(c, d).then(() => undefined);
    },
    "Sanggahan dikirim.",
  );
}
export async function returnProof(sn: string, photos: { url: string; thumbnail: string }[], description?: string) {
  return run("shopee_return_proof", sn, { photos: photos.length, description }, (c) => rt.uploadProof(c, sn, photos, description).then(() => undefined), "Bukti terkirim.");
}
/** Upload 1 foto bukti (FormData: file). */
export async function returnImage(sn: string, form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Pilih foto." } as Res<{ url: string; thumbnail: string }>;
  if (file.size > 10 * 1024 * 1024) return { ok: false, message: "Foto maks 10MB." } as Res<{ url: string; thumbnail: string }>;
  return run("", sn, {}, (c) => rt.convertImage(c, sn, file, file.name || "bukti.jpg"), "");
}
