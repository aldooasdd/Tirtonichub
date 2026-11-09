// Tirtonic.com (web toko sendiri) sebagai toko ketiga di Tirtonic Channel.
// Lewat API /api/hub di tirtonic.com; kunci = POINTS_API_SECRET (sama dengan integrasi Ace Points).
import type { MpItem, MpOrder } from "./shopee";

const base = () => (process.env.TIRTONIC_WEB_URL || "https://www.tirtonic.com").replace(/\/$/, "");
const secret = () => process.env.POINTS_API_SECRET ?? "";
export const websiteReady = () => !!secret();
export const WEBSITE_SHOP = "tirtonic.com";

async function hub<T>(init: { query?: Record<string, string>; body?: unknown }): Promise<T> {
  const url = `${base()}/api/hub${init.query ? `?${new URLSearchParams(init.query)}` : ""}`;
  const res = await fetch(url, {
    method: init.body ? "POST" : "GET",
    headers: { "x-hub-secret": secret(), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(`Tirtonic.com: ${j.error ?? res.status}`);
  return j;
}

// Status web → status gaya marketplace (tab Kelola Pesanan).
const ORDER_STATUS: Record<string, string> = { PAID: "AWAITING_SHIPMENT", SHIPPED: "IN_TRANSIT", DELIVERED: "COMPLETED", CANCELLED: "CANCELLED" };
const PRE_STATUS: Record<string, string> = { DP_PAID: "ON_HOLD", WAITING_LUNAS: "ON_HOLD", LUNAS: "AWAITING_SHIPMENT", SHIPPED: "IN_TRANSIT", CANCELLED: "CANCELLED" };

type WebOrder = {
  sn: string;
  kind: "order" | "preorder";
  status: string;
  buyer: string;
  phone: string;
  address: string;
  courier: string | null;
  resi: string | null;
  note: string | null;
  payment: string | null;
  total: number;
  items: { name: string; qty: number; price: number; image: string | null }[];
  createdAt: string;
  updatedAt: string;
};

export async function websiteOrders(from: Date): Promise<MpOrder[]> {
  const { orders } = await hub<{ orders: WebOrder[] }>({ query: { type: "orders", since: from.toISOString() } });
  return orders.map((o) => {
    const pickup = /^AMBIL DI TOKO/i.test(o.address);
    return {
      orderSn: o.sn,
      status: (o.kind === "preorder" ? PRE_STATUS : ORDER_STATUS)[o.status] ?? o.status,
      buyer: o.buyer,
      items: o.items.map((i) => ({ name: i.name, sku: null, qty: i.qty, price: i.price, image: i.image })),
      total: o.total,
      trackingNo: o.resi,
      recipient: o.buyer,
      phone: o.phone,
      address: o.address,
      courier: pickup ? "Ambil di toko" : o.courier,
      buyerNote: o.note,
      payment: o.payment,
      orderedAt: new Date(o.createdAt),
      updatedAt: new Date(o.updatedAt),
    };
  });
}

type WebProduct = {
  id: string;
  name: string;
  status: string;
  image: string | null;
  price: number;
  stock: number | null;
  variants: { id: string; label: string; price: number; stock: number; image: string | null }[];
};

export const UNLIMITED = 999; // ponytail: stok produk web "tak terbatas" (null) ditampilkan 999

export async function websiteItems(): Promise<(MpItem & { image: string | null; variant: string | null; active: boolean })[]> {
  const { products } = await hub<{ products: WebProduct[] }>({ query: { type: "products" } });
  return products.flatMap((p) =>
    p.variants.length
      ? p.variants.map((v) => ({
          itemId: p.id,
          modelId: v.id,
          name: `${p.name} (${v.label})`,
          sku: null,
          price: v.price,
          stock: v.stock,
          warehouseId: null,
          image: v.image ?? p.image,
          variant: v.label || null,
          active: p.status === "READY",
        }))
      : [{ itemId: p.id, modelId: "", name: p.name, sku: null, price: p.price, stock: p.stock ?? UNLIMITED, warehouseId: null, image: p.image, variant: null, active: p.status === "READY" }],
  );
}

export async function websiteUpdate(productId: string, variantId: string, change: { stock?: number; price?: number }): Promise<void> {
  await hub({ body: { action: "update", productId, variantId: variantId || undefined, ...change } });
}

export async function websiteShip(sn: string, resi: string, kurir: string): Promise<void> {
  await hub({ body: { action: "ship", sn, resi, kurir } });
}

export type WebImportProduct = {
  ref: string;
  name: string;
  brand?: string | null;
  category?: string | null;
  description?: string | null;
  weightGram?: number | null;
  images?: string[];
  price?: number;
  stock?: number;
  variants?: { warna: string; ukuran?: string; price: number; stock: number; image?: string | null }[];
};

/** Buat / perbarui produk di tirtonic.com (upsert per `ref`). */
export async function websiteImport(product: WebImportProduct): Promise<{ created: boolean; skipped?: boolean }> {
  return hub<{ created: boolean; skipped?: boolean }>({ body: { action: "import", product } });
}
