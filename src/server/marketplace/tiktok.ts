// Tokopedia via TikTok Shop Partner API (versi 202309). Env: TIKTOK_APP_KEY, TIKTOK_APP_SECRET, TIKTOK_SERVICE_ID.
// ponytail: endpoint sesuai dokumen Partner Center publik; belum dites ke API asli (nunggu app disetujui).
import { tiktokSign } from "./sign";
import type { MpItem, MpOrder } from "./shopee";

const API = "https://open-api.tiktokglobalshop.com";
const AUTH = "https://auth.tiktok-shops.com";
const key = () => process.env.TIKTOK_APP_KEY ?? "";
const secret = () => process.env.TIKTOK_APP_SECRET ?? "";
export const tiktokReady = () => !!(key() && secret());

const n = (v: unknown) => Math.round(Number(v) || 0);
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

type Tok = { accessToken: string; refreshToken: string; expiresAt: Date };

async function call<T>(path: string, opts: { method?: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown; token: string; cipher?: string }): Promise<T> {
  const query: Record<string, string> = { app_key: key(), timestamp: String(Math.floor(Date.now() / 1000)) };
  if (opts.cipher) query.shop_cipher = opts.cipher;
  for (const [k, v] of Object.entries(opts.query ?? {})) query[k] = String(v);
  const body = opts.body ? JSON.stringify(opts.body) : "";
  query.sign = tiktokSign(secret(), path, query, body);
  const res = await fetch(`${API}${path}?${new URLSearchParams(query)}`, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json", "x-tts-access-token": opts.token },
    body: body || undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await res.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
  if (!res.ok || j.code !== 0) throw new Error(`TikTok ${path}: ${j.code ?? res.status} ${j.message ?? ""}`.trim());
  return j.data as T;
}

/** Link izin toko (dibuka user sekali). */
export function tiktokAuthUrl(state: string): string {
  return `https://services.tiktokshop.com/open/authorize?service_id=${encodeURIComponent(process.env.TIKTOK_SERVICE_ID ?? "")}&state=${encodeURIComponent(state)}`;
}

type TokRes = { access_token: string; access_token_expire_in: number; refresh_token: string; seller_name?: string };
const toTok = (d: TokRes): Tok => ({ accessToken: d.access_token, refreshToken: d.refresh_token, expiresAt: new Date((d.access_token_expire_in - 60) * 1000) });

async function tokenGet(path: string, q: Record<string, string>): Promise<TokRes> {
  const res = await fetch(`${AUTH}${path}?${new URLSearchParams({ app_key: key(), app_secret: secret(), ...q })}`, { signal: AbortSignal.timeout(20_000) });
  const j = (await res.json().catch(() => ({}))) as { code?: number; message?: string; data?: TokRes };
  if (!res.ok || j.code !== 0 || !j.data) throw new Error(`TikTok token: ${j.code ?? res.status} ${j.message ?? ""}`.trim());
  return j.data;
}

export async function tiktokTokenFromCode(code: string): Promise<Tok & { sellerName: string | null }> {
  const d = await tokenGet("/api/v2/token/get", { auth_code: code, grant_type: "authorized_code" });
  return { ...toTok(d), sellerName: d.seller_name ?? null };
}

export async function tiktokRefresh(refreshToken: string): Promise<Tok> {
  return toTok(await tokenGet("/api/v2/token/refresh", { refresh_token: refreshToken, grant_type: "refresh_token" }));
}

/** Toko yang diizinkan → id, nama, cipher (wajib di tiap panggilan toko). */
export async function tiktokShops(token: string): Promise<{ id: string; name: string; cipher: string }[]> {
  const d = await call<{ shops: { id: string; name: string; cipher: string }[] }>("/authorization/202309/shops", { token });
  return d.shops ?? [];
}

export async function tiktokOrders(token: string, cipher: string, from: Date): Promise<MpOrder[]> {
  const out: MpOrder[] = [];
  let pageToken = "";
  do {
    const d = await call<{
      orders?: {
        id: string;
        status: string;
        buyer_email?: string;
        recipient_address?: { name?: string };
        tracking_number?: string;
        create_time: number;
        update_time: number;
        payment?: { total_amount?: string };
        line_items?: { product_name: string; sku_name?: string; seller_sku?: string; sale_price?: string }[];
      }[];
      next_page_token?: string;
    }>("/order/202309/orders/search", {
      method: "POST",
      token,
      cipher,
      query: { page_size: 50, ...(pageToken ? { page_token: pageToken } : {}) },
      body: { update_time_ge: sec(from) },
    });
    for (const o of d.orders ?? []) {
      // line_items TikTok = 1 baris per unit → gabung per SKU.
      const items = new Map<string, { name: string; sku: string | null; qty: number; price: number }>();
      for (const li of o.line_items ?? []) {
        const name = li.sku_name ? `${li.product_name} - ${li.sku_name}` : li.product_name;
        const k = `${name}|${li.seller_sku ?? ""}`;
        const cur = items.get(k);
        if (cur) cur.qty += 1;
        else items.set(k, { name, sku: li.seller_sku || null, qty: 1, price: n(li.sale_price) });
      }
      out.push({
        orderSn: o.id,
        status: o.status,
        buyer: o.recipient_address?.name ?? null,
        items: [...items.values()],
        total: n(o.payment?.total_amount),
        trackingNo: o.tracking_number || null,
        orderedAt: new Date(o.create_time * 1000),
        updatedAt: new Date(o.update_time * 1000),
      });
    }
    pageToken = d.next_page_token ?? "";
  } while (pageToken);
  return out;
}

/** Statement dana cair sejak `from`. */
export async function tiktokStatements(token: string, cipher: string, from: Date): Promise<{ refId: string; revenue: number; fee: number; amount: number; paidAt: Date }[]> {
  const out: { refId: string; revenue: number; fee: number; amount: number; paidAt: Date }[] = [];
  let pageToken = "";
  do {
    const d = await call<{
      statements?: { id: string; statement_time: number; revenue_amount?: string; fee_amount?: string; settlement_amount?: string }[];
      next_page_token?: string;
    }>("/finance/202309/statements", {
      token,
      cipher,
      query: { statement_time_ge: sec(from), sort_field: "statement_time", page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
    });
    for (const s of d.statements ?? []) {
      out.push({ refId: s.id, revenue: n(s.revenue_amount), fee: Math.abs(n(s.fee_amount)), amount: n(s.settlement_amount), paidAt: new Date(s.statement_time * 1000) });
    }
    pageToken = d.next_page_token ?? "";
  } while (pageToken);
  return out;
}

export async function tiktokItems(token: string, cipher: string): Promise<MpItem[]> {
  const out: MpItem[] = [];
  let pageToken = "";
  do {
    const d = await call<{
      products?: {
        id: string;
        title: string;
        skus?: { id: string; seller_sku?: string; price?: { sale_price?: string; tax_exclusive_price?: string }; inventory?: { quantity: number; warehouse_id: string }[] }[];
      }[];
      next_page_token?: string;
    }>("/product/202309/products/search", {
      method: "POST",
      token,
      cipher,
      query: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
      body: { status: "ACTIVATE" },
    });
    for (const p of d.products ?? []) {
      for (const s of p.skus ?? []) {
        const inv = s.inventory?.[0];
        out.push({
          itemId: p.id,
          modelId: s.id,
          name: s.seller_sku ? `${p.title} (${s.seller_sku})` : p.title,
          sku: s.seller_sku || null,
          price: n(s.price?.sale_price ?? s.price?.tax_exclusive_price),
          stock: n(s.inventory?.reduce((a, x) => a + x.quantity, 0)),
          warehouseId: inv?.warehouse_id ?? null,
        });
      }
    }
    pageToken = d.next_page_token ?? "";
  } while (pageToken);
  return out;
}

export async function tiktokSetStock(token: string, cipher: string, productId: string, skuId: string, warehouseId: string | null, stock: number): Promise<void> {
  await call(`/product/202309/products/${productId}/inventory/update`, {
    method: "POST",
    token,
    cipher,
    body: { skus: [{ id: skuId, inventory: [{ ...(warehouseId ? { warehouse_id: warehouseId } : {}), quantity: stock }] }] },
  });
}

export async function tiktokSetPrice(token: string, cipher: string, productId: string, skuId: string, price: number): Promise<void> {
  await call(`/product/202309/products/${productId}/prices/update`, {
    method: "POST",
    token,
    cipher,
    body: { skus: [{ id: skuId, price: { amount: String(price), currency: "IDR" } }] },
  });
}
