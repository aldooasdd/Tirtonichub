"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { activeShop, fresh, DEMO } from "@/server/marketplace/sync";
import * as lg from "@/server/marketplace/shopee-logistics";

type Res<T = undefined> = { ok: boolean; message?: string; data?: T };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");

async function run<T>(action: string, sn: string, after: object, fn: (c: { token: string; shopId: string }) => Promise<T>, okMsg = ""): Promise<Res<T>> {
  const ctx = await requireChannel();
  try {
    const shop = await activeShop("SHOPEE");
    if (!shop || shop.shopId === DEMO) throw new Error("Toko Shopee belum tersambung.");
    const s = await fresh(shop);
    const data = await fn({ token: s.accessToken, shopId: s.shopId });
    if (action) {
      const { ip } = await clientMeta();
      await logActivity({ ...ctx, ip }, { action, entity: "MarketplaceOrder", entityId: sn, after });
      revalidatePath("/channel");
    }
    return { ok: true, message: okMsg, data };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

export async function shopeeShipParam(sn: string) {
  return run("", sn, {}, (c) => lg.shippingParameter(c, sn));
}

/** Atur kirim 1 pesanan, lalu simpan resi kalau sudah keluar. */
export async function shopeeShip(sn: string, choice: lg.ShipChoice) {
  return run(
    "shopee_ship",
    sn,
    choice,
    async (c) => {
      await lg.shipOrder(c, sn, choice);
      const t = await lg.trackingNumber(c, sn).catch(() => "");
      await prisma.marketplaceOrder.updateMany({ where: { platform: "SHOPEE", orderSn: sn }, data: { status: "PROCESSED", ...(t ? { trackingNo: t } : {}) } });
    },
    "Pengiriman diatur.",
  );
}

/** Atur kirim banyak pesanan dengan pilihan yang sama (alamat jemput / drop-off). */
export async function shopeeShipMany(sns: string[], choice: lg.ShipChoice) {
  return run(
    "shopee_ship_mass",
    sns.join(","),
    choice,
    async (c) => {
      const fail: string[] = [];
      for (const sn of sns.slice(0, 100)) {
        try {
          await lg.shipOrder(c, sn, choice);
          await prisma.marketplaceOrder.updateMany({ where: { platform: "SHOPEE", orderSn: sn }, data: { status: "PROCESSED" } });
        } catch (e) {
          fail.push(`${sn}: ${errMsg(e)}`);
        }
      }
      return fail;
    },
    "Selesai.",
  );
}

export async function shopeeTrack(sn: string) {
  return run("", sn, {}, async (c) => {
    const [info, no] = await Promise.all([lg.trackingInfo(c, sn), lg.trackingNumber(c, sn).catch(() => "")]);
    if (no) await prisma.marketplaceOrder.updateMany({ where: { platform: "SHOPEE", orderSn: sn, trackingNo: null }, data: { trackingNo: no } });
    return { ...info, tracking: no };
  });
}

export async function shopeeOrderInfo(sn: string) {
  return run("", sn, {}, (c) => lg.orderInfo(c, sn));
}

export async function shopeeCancel(sn: string, reason: lg.CancelReason, items?: { itemId: string; modelId: string }[]) {
  return run("shopee_cancel", sn, { reason }, (c) => lg.cancelOrder(c, sn, reason, items), "Pesanan dibatalkan.");
}

export async function shopeeBuyerCancel(sn: string, accept: boolean) {
  return run("shopee_buyer_cancel", sn, { accept }, (c) => lg.handleBuyerCancellation(c, sn, accept), accept ? "Pembatalan diterima." : "Pembatalan ditolak.");
}

export async function shopeeNote(sn: string, note: string) {
  return run("shopee_note", sn, { note }, (c) => lg.setNote(c, sn, note.slice(0, 500)), "Catatan disimpan.");
}
