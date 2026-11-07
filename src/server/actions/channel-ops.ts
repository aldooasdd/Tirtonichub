"use server";

import { prisma } from "@/server/db";
import { requireChannel } from "@/server/auth/rbac";
import { logActivity } from "@/server/activity-log";
import { clientMeta } from "@/server/request-meta";
import { DEMO, mustShop } from "@/server/marketplace/sync";
import * as ops from "@/server/marketplace/tiktok-ops";
import { FAIL_REASONS } from "@/lib/channel-status";

// Aksi Tokopedia (TikTok Shop) untuk Tirtonic Channel: kirim pesanan, lacak, bukti antar, faktur, on/off produk, stok gudang.
type Res<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; message: string };
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Gagal.");
const DEMO_MSG = "Mode contoh: aksi ini hanya jalan di toko Tokopedia asli.";

async function ctx() {
  const shop = await mustShop("TOKOPEDIA");
  if (shop.shopId === DEMO) throw new Error(DEMO_MSG);
  return { token: shop.accessToken, cipher: shop.cipher ?? "" };
}

async function order(id: string) {
  const o = await prisma.marketplaceOrder.findUnique({ where: { id } });
  if (!o || o.platform !== "TOKOPEDIA") throw new Error("Pesanan Tokopedia tidak ditemukan.");
  if (o.shopId === DEMO) throw new Error(DEMO_MSG);
  return o;
}

async function log(action: string, entityId: string, after?: unknown) {
  const c = await requireChannel();
  const { ip } = await clientMeta();
  await logActivity({ ...c, ip }, { action, entity: "MarketplaceOrder", entityId, after: after as never });
}

async function run<T>(fn: () => Promise<T>): Promise<Res<T>> {
  await requireChannel();
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    return { ok: false, message: errMsg(e) };
  }
}

// ---------- pesanan ----------
export async function orderPackage(id: string) {
  return run(async () => {
    const o = await order(id);
    if (!o.packageId) throw new Error("Paket belum dibuat untuk pesanan ini. Sinkron ulang setelah pesanan diproses.");
    return ops.packageDetail(await ctx(), o.packageId);
  });
}

export async function orderTracking(id: string) {
  return run(async () => ops.orderTracking(await ctx(), (await order(id)).orderSn));
}

export async function orderDocument(id: string, type: ops.DocType) {
  return run(async () => {
    const o = await order(id);
    if (!o.packageId) throw new Error("Paket belum ada. Label bisa dicetak setelah pesanan diatur pengirimannya.");
    const d = await ops.shippingDocument(await ctx(), o.packageId, type);
    if (d.trackingNo && d.trackingNo !== o.trackingNo) await prisma.marketplaceOrder.update({ where: { id }, data: { trackingNo: d.trackingNo } });
    return d.url;
  });
}

export async function orderProviders(id: string) {
  return run(async () => {
    const o = await order(id);
    const c = await ctx();
    let opt = o.deliveryOptionId;
    if (!opt && o.packageId) opt = (await ops.packageDetail(c, o.packageId)).deliveryOptionId;
    if (!opt) throw new Error("Opsi pengiriman pesanan belum diketahui. Sinkron ulang pesanan.");
    return ops.shippingProviders(c, opt);
  });
}

const RESI = /^[A-Za-z0-9_-]{4,50}$/;

/** Kirim sendiri: tandai dikirim (resi baru) atau ubah resi bila sudah dikirim. */
export async function orderShip(id: string, trackingNo: string, providerId: string, providerName: string) {
  return run(async () => {
    const resi = trackingNo.trim();
    if (!RESI.test(resi)) throw new Error("Resi 4–50 karakter: huruf, angka, - atau _.");
    if (!providerId) throw new Error("Pilih kurir.");
    const o = await order(id);
    const c = await ctx();
    let packageId = o.packageId;
    if (o.status === "AWAITING_SHIPMENT") packageId = (await ops.markShipped(c, o.orderSn, resi, providerId)) ?? packageId;
    else await ops.updateShipping(c, { orderId: o.orderSn, packageId }, resi, providerId);
    await prisma.marketplaceOrder.update({
      where: { id },
      data: { trackingNo: resi, courier: providerName || o.courier, packageId, ...(o.status === "AWAITING_SHIPMENT" ? { status: "IN_TRANSIT" } : {}) },
    });
    await log("channel_order_ship", id, { resi, providerName });
    return undefined;
  });
}

/** Kirim sendiri: status antar (berhasil/gagal/ganti bukti) + bukti foto/PDF opsional. */
export async function orderDelivery(id: string, fd: FormData) {
  return run(async () => {
    const type = String(fd.get("type")) as "DELIVERY_SUCCESS" | "DELIVERY_FAILED" | "UPDATE_POD";
    if (!["DELIVERY_SUCCESS", "DELIVERY_FAILED", "UPDATE_POD"].includes(type)) throw new Error("Status tidak dikenal.");
    const reason = String(fd.get("reason") ?? "");
    if (type === "DELIVERY_FAILED" && !(reason in FAIL_REASONS)) throw new Error("Pilih alasan gagal antar.");
    const o = await order(id);
    if (!o.packageId) throw new Error("Paket belum ada.");
    const c = await ctx();
    const file = fd.get("file");
    let fileUrl: string | undefined;
    let fileType: "IMG" | "PDF" | undefined;
    if (file instanceof File && file.size) {
      const pdf = file.type === "application/pdf";
      if (!pdf && !/^image\/(jpe?g|png)$/.test(file.type)) throw new Error("Bukti harus JPG, PNG, atau PDF.");
      if (file.size > (pdf ? 10 : 5) * 1024 * 1024) throw new Error(pdf ? "PDF maksimal 10MB." : "Gambar maksimal 5MB.");
      fileUrl = await ops.uploadProof(c, file, file.name, pdf);
      fileType = pdf ? "PDF" : "IMG";
    }
    if (type === "UPDATE_POD" && !fileUrl) throw new Error("Lampirkan bukti antar.");
    await ops.deliveryStatus(c, o.packageId, type, { reason: type === "DELIVERY_FAILED" ? reason : undefined, fileUrl, fileType });
    if (type === "DELIVERY_SUCCESS") await prisma.marketplaceOrder.update({ where: { id }, data: { status: "DELIVERED" } });
    await log("channel_order_delivery", id, { type, reason: reason || undefined, bukti: !!fileUrl });
    return undefined;
  });
}

export async function orderInvoice(id: string, fd: FormData) {
  return run(async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Pilih file faktur (XML).");
    if (!/\.xml$/i.test(file.name)) throw new Error("Faktur harus file XML.");
    if (file.size > 1024 * 1024) throw new Error("Faktur maksimal 1MB.");
    const o = await order(id);
    if (!o.packageId) throw new Error("Paket belum ada.");
    await ops.uploadInvoice(await ctx(), o.packageId, [o.orderSn], Buffer.from(await file.arrayBuffer()).toString("base64"));
    await log("channel_order_invoice", id, { file: file.name });
    return undefined;
  });
}

// ---------- produk ----------
export async function productSetActive(productId: string, active: boolean) {
  return run(async () => {
    const p = await prisma.marketplaceProduct.findUnique({ where: { platform_productId: { platform: "TOKOPEDIA", productId } } });
    await ops.setProductsActive(await ctx(), [productId], active, !!p?.tokoStatus);
    const status = active ? "ACTIVATE" : "SELLER_DEACTIVATED";
    if (p) await prisma.marketplaceProduct.update({ where: { id: p.id }, data: { status, ...(p.tokoStatus ? { tokoStatus: status } : {}) } });
    const c = await requireChannel();
    const { ip } = await clientMeta();
    await logActivity({ ...c, ip }, { action: active ? "channel_product_activate" : "channel_product_deactivate", entity: "MarketplaceProduct", entityId: productId });
    return undefined;
  });
}

/** Stok per gudang 1 produk (+ nama gudang). */
export async function productStock(productId: string) {
  return run(async () => {
    const c = await ctx();
    const [inv, whs] = await Promise.all([ops.inventory(c, [productId]), ops.warehouses(c).catch(() => [])]);
    const name = new Map(whs.map((w) => [w.id, w.name]));
    return inv.map((s) => ({ ...s, warehouses: s.warehouses.map((w) => ({ ...w, name: name.get(w.id) ?? w.id })) }));
  });
}

export async function warehouseOptions(warehouseId: string) {
  return run(async () => ops.warehouseDeliveryOptions(await ctx(), warehouseId));
}
