// Shopee Open Platform v2 — toko Tirtonic sendiri. Env: SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, (SHOPEE_HOST untuk sandbox).
// ponytail: endpoint sesuai dokumen v2 publik; belum dites ke API asli (nunggu app Shopee disetujui).
import { shopeeSign } from "./sign";

const host = () => process.env.SHOPEE_HOST || "https://partner.shopeemobile.com";
const pid = () => process.env.SHOPEE_PARTNER_ID ?? "";
const pkey = () => process.env.SHOPEE_PARTNER_KEY ?? "";
export const shopeeReady = () => !!(pid() && pkey());

const now = () => Math.floor(Date.now() / 1000);
const n = (v: unknown) => Math.round(Number(v) || 0);

type Tok = { accessToken: string; refreshToken: string; expiresAt: Date };

async function call<T>(path: string, opts: { method?: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown; token?: string; shopId?: string }): Promise<T> {
  const ts = now();
  const q = new URLSearchParams({ partner_id: pid(), timestamp: String(ts) });
  if (opts.token) {
    q.set("access_token", opts.token);
    q.set("shop_id", opts.shopId ?? "");
  }
  q.set("sign", shopeeSign(pkey(), pid(), path, ts, opts.token ?? "", opts.token ? opts.shopId ?? "" : ""));
  for (const [k, v] of Object.entries(opts.query ?? {})) q.set(k, String(v));
  const res = await fetch(`${host()}${path}?${q}`, {
    method: opts.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string } & T;
  if (!res.ok || j.error) throw new Error(`Shopee ${path}: ${j.error || res.status} ${j.message ?? ""}`.trim());
  return j;
}

/** Link izin toko (dibuka user sekali). */
export function shopeeAuthUrl(redirect: string): string {
  const path = "/api/v2/shop/auth_partner";
  const ts = now();
  return `${host()}${path}?partner_id=${pid()}&timestamp=${ts}&sign=${shopeeSign(pkey(), pid(), path, ts)}&redirect=${encodeURIComponent(redirect)}`;
}

const toTok = (j: { access_token: string; refresh_token: string; expire_in: number }): Tok => ({
  accessToken: j.access_token,
  refreshToken: j.refresh_token,
  expiresAt: new Date(Date.now() + (j.expire_in - 60) * 1000),
});

export async function shopeeTokenFromCode(code: string, shopId: string): Promise<Tok> {
  const j = await call<{ access_token: string; refresh_token: string; expire_in: number }>("/api/v2/auth/token/get", {
    method: "POST",
    body: { code, shop_id: Number(shopId), partner_id: Number(pid()) },
  });
  return toTok(j);
}

export async function shopeeRefresh(refreshToken: string, shopId: string): Promise<Tok> {
  const j = await call<{ access_token: string; refresh_token: string; expire_in: number }>("/api/v2/auth/access_token/get", {
    method: "POST",
    body: { refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(pid()) },
  });
  return toTok(j);
}

export async function shopeeShopName(token: string, shopId: string): Promise<string | null> {
  const j = await call<{ shop_name?: string }>("/api/v2/shop/get_shop_info", { token, shopId }).catch(() => null);
  return j?.shop_name ?? null;
}

export type MpOrder = {
  orderSn: string;
  status: string;
  buyer: string | null;
  items: { name: string; sku: string | null; qty: number; price: number; image?: string | null }[];
  total: number;
  trackingNo: string | null;
  orderedAt: Date;
  updatedAt: Date;
  // Detail pengiriman (opsional; tidak semua sumber punya).
  recipient?: string | null;
  phone?: string | null;
  address?: string | null;
  courier?: string | null;
  buyerNote?: string | null;
  payment?: string | null;
};

/** Order yang berubah sejak `from` (maks 15 hari per jendela, aturan Shopee). */
export async function shopeeOrders(token: string, shopId: string, from: Date): Promise<MpOrder[]> {
  const sns: string[] = [];
  const end = now();
  for (let start = Math.floor(from.getTime() / 1000); start < end; start += 15 * 86400) {
    let cursor = "";
    do {
      const j = await call<{ response: { order_list: { order_sn: string }[]; more: boolean; next_cursor: string } }>("/api/v2/order/get_order_list", {
        token,
        shopId,
        query: { time_range_field: "update_time", time_from: start, time_to: Math.min(start + 15 * 86400 - 1, end), page_size: 100, cursor },
      });
      sns.push(...j.response.order_list.map((o) => o.order_sn));
      cursor = j.response.more ? j.response.next_cursor : "";
    } while (cursor);
  }
  const out: MpOrder[] = [];
  for (let i = 0; i < sns.length; i += 50) {
    const j = await call<{
      response: {
        order_list: {
          order_sn: string;
          order_status: string;
          buyer_username?: string;
          total_amount?: number;
          create_time: number;
          update_time: number;
          item_list?: {
            item_name: string;
            model_name?: string;
            item_sku?: string;
            model_sku?: string;
            model_quantity_purchased: number;
            model_discounted_price: number;
            image_info?: { image_url?: string };
          }[];
          recipient_address?: { name?: string; phone?: string; full_address?: string };
          message_to_seller?: string;
          shipping_carrier?: string;
          payment_method?: string;
        }[];
      };
    }>("/api/v2/order/get_order_detail", {
      token,
      shopId,
      query: { order_sn_list: sns.slice(i, i + 50).join(","), response_optional_fields: "buyer_username,item_list,total_amount,recipient_address,message_to_seller,shipping_carrier,payment_method" },
    });
    for (const o of j.response.order_list) {
      out.push({
        orderSn: o.order_sn,
        status: o.order_status,
        buyer: o.buyer_username ?? null,
        items: (o.item_list ?? []).map((it) => ({
          name: it.model_name ? `${it.item_name} - ${it.model_name}` : it.item_name,
          sku: it.model_sku || it.item_sku || null,
          qty: it.model_quantity_purchased,
          price: n(it.model_discounted_price),
          image: it.image_info?.image_url ?? null,
        })),
        total: n(o.total_amount),
        trackingNo: null,
        recipient: o.recipient_address?.name || null,
        phone: o.recipient_address?.phone || null,
        address: o.recipient_address?.full_address || null,
        courier: o.shipping_carrier || null,
        buyerNote: o.message_to_seller || null,
        payment: o.payment_method || null,
        orderedAt: new Date(o.create_time * 1000),
        updatedAt: new Date(o.update_time * 1000),
      });
    }
  }
  return out;
}

/** Rincian dana cair 1 order: penjualan, potongan, uang bersih. */
export async function shopeeEscrow(token: string, shopId: string, orderSn: string): Promise<{ revenue: number; fee: number; amount: number }> {
  const j = await call<{ response: { order_income: { escrow_amount: number; original_price?: number; buyer_total_amount?: number } } }>("/api/v2/payment/get_escrow_detail", {
    token,
    shopId,
    query: { order_sn: orderSn },
  });
  const inc = j.response.order_income;
  const revenue = n(inc.original_price ?? inc.buyer_total_amount);
  const amount = n(inc.escrow_amount);
  return { revenue, fee: Math.max(0, revenue - amount), amount };
}

export async function shopeeTracking(token: string, shopId: string, orderSn: string): Promise<string | null> {
  const j = await call<{ response: { tracking_number?: string } }>("/api/v2/logistics/get_tracking_number", { token, shopId, query: { order_sn: orderSn } }).catch(() => null);
  return j?.response.tracking_number || null;
}

export type MpItem = { itemId: string; modelId: string; name: string; sku: string | null; price: number; stock: number; warehouseId: string | null; productUpdatedAt?: number };

export async function shopeeItems(token: string, shopId: string): Promise<MpItem[]> {
  const ids: number[] = [];
  let offset = 0;
  for (;;) {
    const j = await call<{ response: { item?: { item_id: number }[]; has_next_page: boolean; next_offset: number } }>("/api/v2/product/get_item_list", {
      token,
      shopId,
      query: { offset, page_size: 100, item_status: "NORMAL" },
    });
    ids.push(...(j.response.item ?? []).map((i) => i.item_id));
    if (!j.response.has_next_page) break;
    offset = j.response.next_offset;
  }
  type Stock = { stock_info_v2?: { summary_info?: { total_available_stock?: number } } };
  type Price = { price_info?: { current_price?: number; original_price?: number }[] };
  const out: MpItem[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const j = await call<{ response: { item_list: ({ item_id: number; item_name: string; item_sku?: string; has_model: boolean } & Stock & Price)[] } }>(
      "/api/v2/product/get_item_base_info",
      { token, shopId, query: { item_id_list: ids.slice(i, i + 50).join(",") } },
    );
    for (const it of j.response.item_list) {
      if (!it.has_model) {
        out.push({
          itemId: String(it.item_id),
          modelId: "",
          name: it.item_name,
          sku: it.item_sku || null,
          price: n(it.price_info?.[0]?.original_price ?? it.price_info?.[0]?.current_price),
          stock: n(it.stock_info_v2?.summary_info?.total_available_stock),
          warehouseId: null,
        });
        continue;
      }
      const m = await call<{ response: { model: ({ model_id: number; model_sku?: string; model_name?: string } & Stock & Price)[] } }>("/api/v2/product/get_model_list", {
        token,
        shopId,
        query: { item_id: it.item_id },
      });
      for (const md of m.response.model) {
        out.push({
          itemId: String(it.item_id),
          modelId: String(md.model_id),
          name: md.model_name ? `${it.item_name} - ${md.model_name}` : it.item_name,
          sku: md.model_sku || null,
          price: n(md.price_info?.[0]?.original_price ?? md.price_info?.[0]?.current_price),
          stock: n(md.stock_info_v2?.summary_info?.total_available_stock),
          warehouseId: null,
        });
      }
    }
  }
  return out;
}

export async function shopeeSetStock(token: string, shopId: string, itemId: string, modelId: string, stock: number): Promise<void> {
  await call("/api/v2/product/update_stock", {
    method: "POST",
    token,
    shopId,
    body: { item_id: Number(itemId), stock_list: [{ model_id: Number(modelId || 0), seller_stock: [{ stock }] }] },
  });
}

export async function shopeeSetPrice(token: string, shopId: string, itemId: string, modelId: string, price: number): Promise<void> {
  await call("/api/v2/product/update_price", {
    method: "POST",
    token,
    shopId,
    body: { item_id: Number(itemId), price_list: [{ model_id: Number(modelId || 0), original_price: price }] },
  });
}

// --- Seller chat (butuh izin Chat API dari Shopee) ---
export type MpConv = { id: string; name: string; avatar: string | null; last: string; at: number; unread: number; toId: string };
// system = pesan otomatis/robot/sistem marketplace (bukan ketikan toko maupun pembeli).
export type MpMsg = { id: string; mine: boolean; text: string; image: string | null; at: number; system?: boolean; bot?: boolean };

/** Shopee campur detik / milidetik / nanodetik → milidetik. */
const toMs = (t: unknown) => {
  const v = Number(t) || 0;
  return v > 1e15 ? Math.floor(v / 1e6) : v > 1e12 ? v : v * 1000;
};

export async function shopeeConversations(token: string, shopId: string): Promise<MpConv[]> {
  const j = await call<{
    response?: {
      conversations?: { conversation_id: string | number; to_id: number; to_name: string; to_avatar?: string; unread_count?: number; latest_message_content?: { text?: string }; latest_message_type?: string; last_message_timestamp?: number }[];
    };
  }>("/api/v2/sellerchat/get_conversation_list", { token, shopId, query: { direction: "latest", type: "all", page_size: 30 } });
  return (j.response?.conversations ?? []).map((c) => ({
    id: String(c.conversation_id),
    name: c.to_name,
    avatar: c.to_avatar || null,
    last: c.latest_message_content?.text ?? (c.latest_message_type ? `[${c.latest_message_type}]` : ""),
    at: toMs(c.last_message_timestamp),
    unread: c.unread_count ?? 0,
    toId: String(c.to_id),
  }));
}

export async function shopeeMessages(token: string, shopId: string, convId: string): Promise<MpMsg[]> {
  const j = await call<{
    response?: { messages?: { message_id: string; from_shop_id?: number; message_type: string; content?: { text?: string; url?: string }; created_timestamp: number }[] };
  }>("/api/v2/sellerchat/get_message", { token, shopId, query: { conversation_id: convId, page_size: 50 } });
  return (j.response?.messages ?? [])
    .map((m) => ({
      id: m.message_id,
      mine: String(m.from_shop_id ?? "") === shopId,
      text: m.content?.text ?? (m.message_type === "image" ? "" : `[${m.message_type}]`),
      image: m.message_type === "image" ? m.content?.url ?? null : null,
      at: toMs(m.created_timestamp),
    }))
    .sort((a, b) => a.at - b.at);
}

export async function shopeeSendText(token: string, shopId: string, toId: string, text: string): Promise<void> {
  await call("/api/v2/sellerchat/send_message", { method: "POST", token, shopId, body: { to_id: Number(toId), message_type: "text", content: { text } } });
}
