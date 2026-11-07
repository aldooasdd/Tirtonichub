// Sinkron toko Shopee & Tokopedia ke DB. shopId "demo" = data contoh (uji coba tanpa API asli).
import { prisma } from "@/server/db";
import { notifyRole } from "@/server/notify";
import * as shopee from "./shopee";
import * as tiktok from "./tiktok";
import type { MpItem, MpOrder } from "./shopee";

export type Platform = "SHOPEE" | "TOKOPEDIA";
export const PLATFORMS: Platform[] = ["SHOPEE", "TOKOPEDIA"];
export const PLATFORM_LABEL: Record<Platform, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia" };
export const DEMO = "demo";
export const isPlatform = (p: string): p is Platform => p === "SHOPEE" || p === "TOKOPEDIA";
export const apiReady = (p: Platform) => (p === "SHOPEE" ? shopee.shopeeReady() : tiktok.tiktokReady());

type Shop = NonNullable<Awaited<ReturnType<typeof prisma.marketplaceShop.findFirst>>>;

export async function activeShop(platform: Platform): Promise<Shop | null> {
  return prisma.marketplaceShop.findFirst({ where: { platform }, orderBy: { connectedAt: "desc" } });
}

/** Token masih segar? Kalau ≤5 menit lagi habis → refresh & simpan. */
async function fresh(shop: Shop): Promise<Shop> {
  if (shop.shopId === DEMO || shop.expiresAt.getTime() - Date.now() > 5 * 60_000) return shop;
  const t =
    shop.platform === "SHOPEE" ? await shopee.shopeeRefresh(shop.refreshToken, shop.shopId) : await tiktok.tiktokRefresh(shop.refreshToken);
  return prisma.marketplaceShop.update({ where: { id: shop.id }, data: t });
}

async function mustShop(platform: Platform): Promise<Shop> {
  const s = await activeShop(platform);
  if (!s) throw new Error(`${PLATFORM_LABEL[platform]} belum tersambung.`);
  return fresh(s);
}

/** Simpan toko setelah izin (hapus data contoh platform itu). */
export async function saveShop(platform: Platform, d: { shopId: string; shopName: string | null; cipher?: string | null; accessToken: string; refreshToken: string; expiresAt: Date }) {
  await clearDemo(platform);
  await prisma.marketplaceShop.upsert({
    where: { platform_shopId: { platform, shopId: d.shopId } },
    create: { platform, ...d },
    update: { ...d, connectedAt: new Date() },
  });
}

export async function clearDemo(platform?: Platform) {
  const where = { shopId: DEMO, ...(platform ? { platform } : {}) };
  await prisma.$transaction([
    prisma.marketplaceOrder.deleteMany({ where }),
    prisma.marketplaceItem.deleteMany({ where }),
    prisma.marketplacePayout.deleteMany({ where }),
    prisma.marketplaceShop.deleteMany({ where }),
  ]);
}

// ---------- data contoh ----------
const DEMO_PRODUCTS = [
  { name: "Grip Tenis Ibuki Pro Dry Feel Overgrip", sku: "IBK-PDF", price: 45000 },
  { name: "Senar Tenis Solinco Hyper G 1.25 Potongan Reel 12m", sku: "SLC-HG125", price: 129000 },
  { name: "Kaos Kaki Tenis Yonex 3/4 Reguler", sku: "YNX-SOCK", price: 99000 },
  { name: "Bola Tenis Head Tour XT isi 4", sku: "HEAD-TXT4", price: 175000 },
  { name: "Sepatu Tenis Mizuno Wave Exceed Tour 7 - 42", sku: "MZN-WET7-42", price: 2399000 },
];
const DEMO_STATUS = ["UNPAID", "READY_TO_SHIP", "SHIPPED", "COMPLETED", "COMPLETED", "CANCELLED"];
const DEMO_BUYERS = ["andi.tenis", "rina_sport", "budi99", "sari.ace", "tomi.smash"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

function demoOrder(platform: Platform, at: Date): MpOrder {
  const p = pick(DEMO_PRODUCTS);
  const qty = 1 + Math.floor(Math.random() * 3);
  const sn = (platform === "SHOPEE" ? "DEMO-SP-" : "DEMO-TP-") + at.getTime().toString(36).toUpperCase() + Math.floor(Math.random() * 1e4);
  const status = pick(DEMO_STATUS);
  return {
    orderSn: sn,
    status,
    buyer: pick(DEMO_BUYERS),
    items: [{ name: p.name, sku: p.sku, qty, price: p.price }],
    total: p.price * qty,
    trackingNo: status === "SHIPPED" || status === "COMPLETED" ? "SPX" + Math.floor(Math.random() * 1e10) : null,
    orderedAt: at,
    updatedAt: at,
  };
}

/** Isi toko contoh Shopee & Tokopedia: produk, 20 order 30 hari terakhir, dana cair. */
export async function startDemo() {
  for (const platform of PLATFORMS) {
    if (await prisma.marketplaceShop.findFirst({ where: { platform, NOT: { shopId: DEMO } } })) continue; // sudah toko asli
    await clearDemo(platform);
    await prisma.marketplaceShop.create({
      data: { platform, shopId: DEMO, shopName: `Tirtonic (contoh ${PLATFORM_LABEL[platform]})`, accessToken: "-", refreshToken: "-", expiresAt: new Date("2100-01-01") },
    });
    await prisma.marketplaceItem.createMany({
      data: DEMO_PRODUCTS.map((p, i) => ({ platform, shopId: DEMO, itemId: `demo-${i}`, modelId: "", name: p.name, sku: p.sku, price: p.price, stock: 5 + i * 3 })),
    });
    const orders = Array.from({ length: 20 }, (_, i) => demoOrder(platform, new Date(Date.now() - i * 1.5 * 86400_000)));
    await upsertOrders(platform, DEMO, orders, false);
  }
}

// ---------- sinkron ----------
const FEE_RATE = 0.17; // ponytail: potongan contoh ±17% (mirip laporan Okt); data asli dari API

async function upsertOrders(platform: Platform, shopId: string, orders: MpOrder[], notify: boolean): Promise<number> {
  const known = new Set(
    (await prisma.marketplaceOrder.findMany({ where: { platform, orderSn: { in: orders.map((o) => o.orderSn) } }, select: { orderSn: true } })).map((o) => o.orderSn),
  );
  for (const o of orders) {
    const data = {
      shopId,
      status: o.status,
      buyer: o.buyer,
      items: o.items,
      total: o.total,
      ...(o.trackingNo ? { trackingNo: o.trackingNo } : {}),
      orderedAt: o.orderedAt,
      updatedAtMp: o.updatedAt,
    };
    await prisma.marketplaceOrder.upsert({ where: { platform_orderSn: { platform, orderSn: o.orderSn } }, create: { platform, orderSn: o.orderSn, ...data }, update: data });
    if (shopId === DEMO && o.status === "COMPLETED") {
      const amount = Math.round(o.total * (1 - FEE_RATE));
      await prisma.marketplaceOrder.update({ where: { platform_orderSn: { platform, orderSn: o.orderSn } }, data: { netAmount: amount } });
      await prisma.marketplacePayout.upsert({
        where: { platform_refId: { platform, refId: o.orderSn } },
        create: { platform, shopId, refId: o.orderSn, revenue: o.total, fee: o.total - amount, amount, paidAt: o.updatedAt },
        update: {},
      });
    }
  }
  const fresh = orders.filter((o) => !known.has(o.orderSn));
  if (notify && fresh.length) {
    const sum = fresh.reduce((s, o) => s + o.total, 0);
    await notifyRole("CHANNEL", {
      type: "channel_order",
      title: `${fresh.length} order baru ${PLATFORM_LABEL[platform]} · Rp ${new Intl.NumberFormat("id-ID").format(sum)}`,
      link: "/channel",
    });
  }
  return fresh.length;
}

/** Tarik order (default 7 hari terakhir) + dana cair + resi. Kembalikan jumlah order & order baru. */
export async function syncOrders(platform: Platform, days = 7): Promise<{ total: number; baru: number }> {
  const shop = await mustShop(platform);
  const from = new Date(Date.now() - days * 86400_000);
  let orders: MpOrder[];
  if (shop.shopId === DEMO) {
    orders = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => demoOrder(platform, new Date()));
  } else if (platform === "SHOPEE") {
    orders = await shopee.shopeeOrders(shop.accessToken, shop.shopId, from);
  } else {
    orders = await tiktok.tiktokOrders(shop.accessToken, shop.cipher ?? "", from);
  }
  const baru = await upsertOrders(platform, shop.shopId, orders, true);

  if (shop.shopId !== DEMO && platform === "SHOPEE") {
    // Dana cair & resi per order (maks 30 per sinkron biar tak kena limit).
    const needEscrow = await prisma.marketplaceOrder.findMany({ where: { platform, shopId: shop.shopId, status: "COMPLETED", netAmount: null }, take: 30 });
    for (const o of needEscrow) {
      const e = await shopee.shopeeEscrow(shop.accessToken, shop.shopId, o.orderSn).catch(() => null);
      if (!e) continue;
      await prisma.marketplaceOrder.update({ where: { id: o.id }, data: { netAmount: e.amount } });
      await prisma.marketplacePayout.upsert({
        where: { platform_refId: { platform, refId: o.orderSn } },
        create: { platform, shopId: shop.shopId, refId: o.orderSn, ...e, paidAt: o.updatedAtMp },
        update: e,
      });
    }
    const needResi = await prisma.marketplaceOrder.findMany({
      where: { platform, shopId: shop.shopId, trackingNo: null, status: { in: ["READY_TO_SHIP", "PROCESSED", "SHIPPED"] } },
      take: 30,
    });
    for (const o of needResi) {
      const t = await shopee.shopeeTracking(shop.accessToken, shop.shopId, o.orderSn);
      if (t) await prisma.marketplaceOrder.update({ where: { id: o.id }, data: { trackingNo: t } });
    }
  }
  if (shop.shopId !== DEMO && platform === "TOKOPEDIA") {
    const st = await tiktok.tiktokStatements(shop.accessToken, shop.cipher ?? "", new Date(Date.now() - 35 * 86400_000));
    for (const s of st) {
      await prisma.marketplacePayout.upsert({
        where: { platform_refId: { platform, refId: s.refId } },
        create: { platform, shopId: shop.shopId, ...s },
        update: s,
      });
    }
  }
  await prisma.marketplaceShop.update({ where: { id: shop.id }, data: { lastSyncAt: new Date() } });
  return { total: orders.length, baru };
}

/** Tarik daftar produk + stok + harga dari marketplace. */
export async function syncItems(platform: Platform): Promise<number> {
  const shop = await mustShop(platform);
  if (shop.shopId === DEMO) return prisma.marketplaceItem.count({ where: { platform, shopId: DEMO } });
  const items: MpItem[] =
    platform === "SHOPEE" ? await shopee.shopeeItems(shop.accessToken, shop.shopId) : await tiktok.tiktokItems(shop.accessToken, shop.cipher ?? "");
  for (const it of items) {
    const data = { shopId: shop.shopId, name: it.name, sku: it.sku, price: it.price, stock: it.stock, warehouseId: it.warehouseId };
    await prisma.marketplaceItem.upsert({
      where: { platform_itemId_modelId: { platform, itemId: it.itemId, modelId: it.modelId } },
      create: { platform, itemId: it.itemId, modelId: it.modelId, ...data },
      update: data,
    });
  }
  return items.length;
}

/** Ubah stok/harga 1 produk di marketplace, lalu simpan di DB. Toko contoh: hanya DB. */
export async function pushItem(id: string, change: { stock?: number; price?: number }) {
  const it = await prisma.marketplaceItem.findUnique({ where: { id } });
  if (!it || !isPlatform(it.platform)) throw new Error("Produk tidak ditemukan.");
  if (it.shopId !== DEMO) {
    const shop = await mustShop(it.platform);
    if (it.platform === "SHOPEE") {
      if (change.stock != null) await shopee.shopeeSetStock(shop.accessToken, shop.shopId, it.itemId, it.modelId, change.stock);
      if (change.price != null) await shopee.shopeeSetPrice(shop.accessToken, shop.shopId, it.itemId, it.modelId, change.price);
    } else {
      if (change.stock != null) await tiktok.tiktokSetStock(shop.accessToken, shop.cipher ?? "", it.itemId, it.modelId, it.warehouseId, change.stock);
      if (change.price != null) await tiktok.tiktokSetPrice(shop.accessToken, shop.cipher ?? "", it.itemId, it.modelId, change.price);
    }
  }
  await prisma.marketplaceItem.update({ where: { id }, data: change });
}

let running = false;
let tick = 0;
/** Sinkron otomatis (dipanggil timer di instrumentation.ts tiap 10 menit): order 3 hari terakhir
 *  + dana cair; produk/stok tiap jam. Toko contoh & yang belum tersambung dilewati. */
export async function autoSyncTick() {
  if (running) return; // ponytail: kunci per proses; cukup karena web jalan 1 container
  running = true;
  const withItems = tick++ % 6 === 0;
  try {
    for (const p of PLATFORMS) {
      const shop = await activeShop(p);
      if (!shop || shop.shopId === DEMO) continue;
      await syncOrders(p, 3).catch((e) => console.error(`[auto-sync] ${p} order:`, e instanceof Error ? e.message : e));
      if (withItems) await syncItems(p).catch((e) => console.error(`[auto-sync] ${p} produk:`, e instanceof Error ? e.message : e));
    }
  } finally {
    running = false;
  }
}
