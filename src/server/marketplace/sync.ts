// Sinkron toko Shopee, Tokopedia & Tirtonic.com ke DB. shopId "demo" = data contoh (uji coba tanpa API asli).
import { prisma } from "@/server/db";
import { Prisma } from "@/generated/prisma";
import { notifyRole } from "@/server/notify";
import * as shopee from "./shopee";
import * as tiktok from "./tiktok";
import * as website from "./website";
import type { MpItem, MpOrder } from "./shopee";

export type Marketplace = "SHOPEE" | "TOKOPEDIA";
export type Platform = Marketplace | "WEBSITE"; // WEBSITE = tirtonic.com (web toko sendiri, tanpa chat/settlement)
export const PLATFORMS: Marketplace[] = ["SHOPEE", "TOKOPEDIA"];
export const CHANNELS: Platform[] = ["SHOPEE", "TOKOPEDIA", "WEBSITE"];
export const PLATFORM_LABEL: Record<Platform, string> = { SHOPEE: "Shopee", TOKOPEDIA: "Tokopedia", WEBSITE: "Tirtonic.com" };
export const DEMO = "demo";
export const isPlatform = (p: string): p is Marketplace => p === "SHOPEE" || p === "TOKOPEDIA";
export const isChannel = (p: string): p is Platform => isPlatform(p) || p === "WEBSITE";
export const apiReady = (p: Platform) => (p === "SHOPEE" ? shopee.shopeeReady() : p === "TOKOPEDIA" ? tiktok.tiktokReady() : website.websiteReady());

type Shop = NonNullable<Awaited<ReturnType<typeof prisma.marketplaceShop.findFirst>>>;

export async function activeShop(platform: Platform): Promise<Shop | null> {
  return prisma.marketplaceShop.findFirst({ where: { platform }, orderBy: { connectedAt: "desc" } });
}

/** Token masih segar? Kalau ≤5 menit lagi habis → refresh & simpan. */
export async function fresh(shop: Shop): Promise<Shop> {
  if (shop.shopId === DEMO || shop.platform === "WEBSITE" || shop.expiresAt.getTime() - Date.now() > 5 * 60_000) return shop;
  const t =
    shop.platform === "SHOPEE" ? await shopee.shopeeRefresh(shop.refreshToken, shop.shopId) : await tiktok.tiktokRefresh(shop.refreshToken);
  return prisma.marketplaceShop.update({ where: { id: shop.id }, data: t });
}

export async function mustShop(platform: Platform): Promise<Shop> {
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
    recipient: "Budi Santoso",
    phone: "62812****678",
    address: "Jl. Raya Darmo No. 10, Wonokromo, Surabaya, Jawa Timur 60241",
    courier: platform === "SHOPEE" ? "SPX Standard" : "J&T Express",
    buyerNote: Math.random() < 0.3 ? "Tolong dibungkus rapi ya kak" : null,
    payment: pick(["Transfer Bank", "COD", "ShopeePay", "GoPay"]),
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
      // Detail pengiriman: hanya timpa bila sumber mengirim nilai.
      ...Object.fromEntries((["recipient", "phone", "address", "courier", "buyerNote", "payment", "packageId", "deliveryOptionId", "shippingType"] as const).filter((k) => o[k]).map((k) => [k, o[k]])),
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

const backfilled = new Set<string>();

/** Tarik order (default 7 hari terakhir) + dana cair + resi. Kembalikan jumlah order & order baru. */
export async function syncOrders(platform: Platform, days = 7): Promise<{ total: number; baru: number; settlement?: string }> {
  const shop = await mustShop(platform);
  // Belum punya riwayat (tak ada pesanan >14 hari): tarik 90 hari sekali per proses server (pesanan lama + settlement-nya).
  if (shop.shopId !== DEMO && !backfilled.has(shop.id)) {
    backfilled.add(shop.id);
    const old = await prisma.marketplaceOrder.findFirst({ where: { platform, shopId: shop.shopId, orderedAt: { lt: new Date(Date.now() - 14 * 86400_000) } }, select: { id: true } });
    if (!old) days = Math.max(days, 90);
  }
  let settlement: string | undefined;
  const from = new Date(Date.now() - days * 86400_000);
  let orders: MpOrder[];
  if (shop.shopId === DEMO) {
    orders = Array.from({ length: 1 + Math.floor(Math.random() * 2) }, () => demoOrder(platform, new Date()));
  } else if (platform === "SHOPEE") {
    orders = await shopee.shopeeOrders(shop.accessToken, shop.shopId, from);
  } else if (platform === "WEBSITE") {
    orders = await website.websiteOrders(from);
  } else {
    orders = await tiktok.tiktokOrders(shop.accessToken, shop.cipher ?? "", from);
  }
  const baru = await upsertOrders(platform, shop.shopId, orders, true);

  if (shop.shopId !== DEMO && platform === "SHOPEE") {
    // Settlement & resi per order (maks 100 per sinkron biar tak kena limit; sisanya sinkron berikutnya).
    const needEscrow = await prisma.marketplaceOrder.findMany({ where: { platform, shopId: shop.shopId, status: "COMPLETED", netAmount: null }, orderBy: { orderedAt: "desc" }, take: 100 });
    let okE = 0;
    let errE = "";
    for (const o of needEscrow) {
      const e = await shopee.shopeeEscrow(shop.accessToken, shop.shopId, o.orderSn).catch((x) => {
        errE = x instanceof Error ? x.message : String(x);
        return null;
      });
      if (!e) continue;
      okE++;
      await prisma.marketplaceOrder.update({ where: { id: o.id }, data: { netAmount: e.amount } });
      await prisma.marketplacePayout.upsert({
        where: { platform_refId: { platform, refId: o.orderSn } },
        create: { platform, shopId: shop.shopId, refId: o.orderSn, ...e, paidAt: o.updatedAtMp },
        update: e,
      });
    }
    if (needEscrow.length) {
      settlement = `settlement ${okE}/${needEscrow.length} pesanan selesai${errE ? ` (error: ${errE.slice(0, 200)})` : ""}`;
      if (errE) console.error(`[settlement] Shopee ${settlement}`);
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
    const pays = await tiktok.tiktokPayments(shop.accessToken, shop.cipher ?? "", new Date(Date.now() - 35 * 86400_000)).catch((e) => {
      console.error("[keuangan] payments:", e instanceof Error ? e.message : e);
      return [];
    });
    for (const p of pays) {
      const data = { status: p.status, amount: p.amount, bankAccount: p.bankAccount, createdAtMp: p.createdAt, paidTime: p.paidTime };
      await prisma.marketplaceTransfer.upsert({ where: { platform_paymentId: { platform, paymentId: p.paymentId } }, create: { platform, paymentId: p.paymentId, ...data }, update: data });
    }
    void syncOrderFinance(shop);
  }
  await prisma.marketplaceShop.update({ where: { id: shop.id }, data: { lastSyncAt: new Date() } });
  return { total: orders.length, baru, settlement };
}

let financeRunning = false;
const FINANCE_BATCH = 200; // ponytail: maks 200 order per putaran (tiap 10 menit); cukup utk volume toko sekarang
/** Rincian dana (Get Transactions by Order) untuk order Tokopedia selesai yang belum punya rincian.
 *  Belum settle (respons kosong) → dicoba lagi paling cepat 6 jam kemudian. */
async function syncOrderFinance(shop: Shop) {
  if (financeRunning) return;
  financeRunning = true;
  try {
    const orders = await prisma.marketplaceOrder.findMany({
      where: {
        platform: "TOKOPEDIA",
        shopId: shop.shopId,
        status: "COMPLETED",
        finance: { equals: Prisma.DbNull },
        OR: [{ financeAt: null }, { financeAt: { lt: new Date(Date.now() - 6 * 3600_000) } }],
      },
      orderBy: { orderedAt: "desc" },
      take: FINANCE_BATCH,
      select: { id: true, orderSn: true },
    });
    let ok = 0;
    let lastErr = "";
    const queue = [...orders];
    const worker = async () => {
      for (let o = queue.shift(); o; o = queue.shift()) {
        try {
          const f = await tiktok.tiktokOrderFinance(shop.accessToken, shop.cipher ?? "", o.orderSn);
          await prisma.marketplaceOrder.update({
            where: { id: o.id },
            data: f ? { finance: f, financeAt: new Date(), netAmount: f.settlement } : { financeAt: new Date() },
          });
          if (f) ok++;
        } catch (e) {
          lastErr = `${o.orderSn}: ${e instanceof Error ? e.message.slice(-300) : String(e)}`;
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    if (orders.length) console.log(`[keuangan] rincian dana ${ok}/${orders.length} order${lastErr ? `, error terakhir ${lastErr}` : ""}`);
  } finally {
    financeRunning = false;
  }
}

/** Tarik daftar produk + stok + harga dari marketplace. */
export async function syncItems(platform: Platform): Promise<number> {
  const shop = await mustShop(platform);
  if (shop.shopId === DEMO) return prisma.marketplaceItem.count({ where: { platform, shopId: DEMO } });
  if (platform === "WEBSITE") {
    const items = await website.websiteItems();
    for (const it of items) {
      const data = { shopId: shop.shopId, name: it.name, sku: it.sku, price: it.price, stock: it.stock, image: it.image, variant: it.variant, skuStatus: it.active ? "NORMAL" : "DEACTIVATED" };
      await prisma.marketplaceItem.upsert({
        where: { platform_itemId_modelId: { platform, itemId: it.itemId, modelId: it.modelId } },
        create: { platform, itemId: it.itemId, modelId: it.modelId, ...data },
        update: data,
      });
    }
    // Produk / varian yang sudah dihapus di web → hapus juga di sini.
    const keep = new Set(items.map((i) => `${i.itemId}:${i.modelId}`));
    const stale = (await prisma.marketplaceItem.findMany({ where: { platform }, select: { id: true, itemId: true, modelId: true } })).filter((i) => !keep.has(`${i.itemId}:${i.modelId}`));
    if (stale.length) await prisma.marketplaceItem.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });
    await prisma.marketplaceShop.update({ where: { id: shop.id }, data: { lastSyncAt: new Date() } });
    return items.length;
  }
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
  // Detail produk jalan di latar belakang: tombol Sinkron tak menunggu ribuan Get Product.
  if (platform === "TOKOPEDIA") void syncProductDetails(shop, items);
  return items.length;
}

/** Produk Master: ambil detail (Get Product) untuk produk baru / yang berubah sejak sinkron terakhir. */
let detailRunning = false;
const DETAIL_CONCURRENCY = 5; // ponytail: 5 Get Product paralel; turunkan bila kena limit QPS TikTok

async function syncProductDetails(shop: Shop, items: MpItem[]) {
  if (detailRunning) return; // satu proses per server
  detailRunning = true;
  try {
    await runProductDetails(shop, items);
  } catch (e) {
    console.error("[produk-master] berhenti:", e);
  } finally {
    detailRunning = false;
  }
}

async function runProductDetails(shop: Shop, items: MpItem[]) {
  const latest = new Map<string, number>();
  for (const it of items) latest.set(it.itemId, Math.max(latest.get(it.itemId) ?? 0, it.productUpdatedAt ?? 0));
  const stored = await prisma.marketplaceProduct.findMany({ where: { platform: "TOKOPEDIA" }, select: { productId: true, updatedAtMp: true } });
  const known = new Map(stored.map((p) => [p.productId, p.updatedAtMp ? p.updatedAtMp.getTime() / 1000 : 0]));
  const todo = [...latest].filter(([id, upd]) => !known.has(id) || (upd && upd > (known.get(id) ?? 0))).map(([id]) => id);

  let gagal = 0;
  let lastErr = "";
  const queue = [...todo];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await saveDetail(id).catch((e) => {
        gagal++;
        lastErr = `simpan ${id}: ${e instanceof Error ? e.message.slice(-400) : String(e)}`; // ekor pesan Prisma = alasan error
      });
    }
  };
  const saveDetail = async (id: string) => {
    const d = await tiktok.tiktokProductDetail(shop.accessToken, shop.cipher ?? "", id).catch((e) => {
      gagal++;
      lastErr = `ambil ${id}: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`;
      return null;
    });
    if (!d) return;
    const data = {
      title: d.title,
      status: d.status,
      tokoStatus: d.tokoStatus,
      description: d.description,
      category: d.category,
      brand: d.brand,
      images: d.images,
      video: d.video ?? undefined,
      attributes: d.attributes,
      weight: d.weight,
      dimensions: d.dimensions,
      minOrder: d.minOrder,
      isCod: d.isCod,
      preOwned: d.preOwned,
      detailUrl: d.detailUrl,
      createdAtMp: d.createdAt,
      updatedAtMp: d.updatedAt,
    };
    await prisma.marketplaceProduct.upsert({
      where: { platform_productId: { platform: "TOKOPEDIA", productId: id } },
      create: { platform: "TOKOPEDIA", productId: id, ...data },
      update: data,
    });
    for (const sku of d.skus) {
      await prisma.marketplaceItem.updateMany({
        where: { platform: "TOKOPEDIA", itemId: id, modelId: sku.id },
        data: { variant: sku.variant, image: sku.image ?? d.images[0] ?? null, skuStatus: sku.status },
      });
    }
  };
  await Promise.all(Array.from({ length: DETAIL_CONCURRENCY }, worker));
  if (todo.length) console.log(`[produk-master] detail ${todo.length - gagal}/${todo.length} produk${gagal ? `, gagal ${gagal}: ${lastErr}` : ""}`);
}

/** Ubah stok/harga 1 produk di marketplace, lalu simpan di DB. Toko contoh: hanya DB. */
export async function pushItem(id: string, change: { stock?: number; price?: number }) {
  const it = await prisma.marketplaceItem.findUnique({ where: { id } });
  if (!it || !isChannel(it.platform)) throw new Error("Produk tidak ditemukan.");
  if (it.platform === "WEBSITE") await website.websiteUpdate(it.itemId, it.modelId, change);
  else if (it.shopId !== DEMO) {
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
    for (const p of CHANNELS) {
      const shop = await activeShop(p);
      if (!shop || shop.shopId === DEMO) continue;
      await syncOrders(p, 3).catch((e) => console.error(`[auto-sync] ${p} order:`, e instanceof Error ? e.message : e));
      if (withItems) await syncItems(p).catch((e) => console.error(`[auto-sync] ${p} produk:`, e instanceof Error ? e.message : e));
    }
  } finally {
    running = false;
  }
}
