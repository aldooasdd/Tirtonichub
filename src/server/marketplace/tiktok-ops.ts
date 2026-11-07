// Tokopedia (TikTok Shop API): kirim pesanan, lacak, bukti antar, faktur, on/off produk, gudang & stok.
// Sesuai dokumen di ~/Downloads (Get Package Detail, Mark Package As Shipped, dst).
import { tiktokSign } from "./sign";
import { call } from "./tiktok";

const API = "https://open-api.tiktokglobalshop.com";
type Ctx = { token: string; cipher: string };
const enc = encodeURIComponent;
const ts = (s?: number) => (s ? new Date(s * 1000) : null);

/** Upload multipart (field "data"); tanda tangan tanpa body, sama seperti upload gambar chat. */
export async function upload<T>(c: Ctx, path: string, file: Blob, name: string, extra: Record<string, string> = {}): Promise<T> {
  const query: Record<string, string> = { app_key: process.env.TIKTOK_APP_KEY ?? "", timestamp: String(Math.floor(Date.now() / 1000)), shop_cipher: c.cipher };
  query.sign = tiktokSign(process.env.TIKTOK_APP_SECRET ?? "", path, query);
  const fd = new FormData();
  fd.append("data", file, name);
  for (const [k, v] of Object.entries(extra)) fd.append(k, v);
  const res = await fetch(`${API}${path}?${new URLSearchParams(query)}`, { method: "POST", headers: { "x-tts-access-token": c.token }, body: fd, signal: AbortSignal.timeout(30_000) });
  const j = (await res.json().catch(() => ({}))) as { code?: number; message?: string; data?: T };
  if (!res.ok || j.code !== 0 || !j.data) throw new Error(`TikTok ${path}: ${j.code ?? res.status} ${j.message ?? ""}`.trim());
  return j.data;
}

// Error per item di respons batch (code 0 tetap bisa berisi errors).
function batchErrors(d: { errors?: { message?: string; detail?: { extra_errors?: { message?: string }[] } }[] } | undefined) {
  const e = d?.errors?.[0];
  if (e) throw new Error([e.message, ...(e.detail?.extra_errors ?? []).map((x) => x.message)].filter(Boolean).join(" · "));
}

// ---------- paket & pengiriman ----------
export type PackageInfo = {
  status: string | null;
  subStatus: string | null;
  shippingType: string | null;
  provider: string | null;
  providerId: string | null;
  trackingNo: string | null;
  deliveryOption: string | null;
  deliveryOptionId: string | null;
  handover: string | null;
  pickupStart: Date | null;
  pickupEnd: Date | null;
  weight: string | null;
  dimension: string | null;
  sender: string | null;
};

export async function packageDetail(c: Ctx, packageId: string): Promise<PackageInfo> {
  const d = await call<{
    package_status?: string;
    package_sub_status?: string;
    shipping_type?: string;
    shipping_provider_name?: string;
    shipping_provider_id?: string;
    tracking_number?: string;
    delivery_option_name?: string;
    delivery_option_id?: string;
    handover_method?: string;
    pickup_slot?: { start_time?: number; end_time?: number };
    weight?: { value?: string; unit?: string };
    dimension?: { length?: string; width?: string; height?: string; unit?: string };
    sender_address?: { name?: string; full_address?: string };
  }>(`/fulfillment/202309/packages/${enc(packageId)}`, c);
  const dm = d.dimension;
  return {
    status: d.package_status ?? null,
    subStatus: d.package_sub_status ?? null,
    shippingType: d.shipping_type ?? null,
    provider: d.shipping_provider_name || null,
    providerId: d.shipping_provider_id || null,
    trackingNo: d.tracking_number || null,
    deliveryOption: d.delivery_option_name || null,
    deliveryOptionId: d.delivery_option_id || null,
    handover: d.handover_method ?? null,
    pickupStart: ts(d.pickup_slot?.start_time),
    pickupEnd: ts(d.pickup_slot?.end_time),
    weight: d.weight?.value ? `${d.weight.value} ${d.weight.unit ?? ""}`.trim() : null,
    dimension: dm?.length ? `${dm.length}×${dm.width}×${dm.height} ${dm.unit ?? ""}`.trim() : null,
    sender: [d.sender_address?.name, d.sender_address?.full_address].filter(Boolean).join(" · ") || null,
  };
}

export type DocType = "SHIPPING_LABEL" | "PACKING_SLIP" | "SHIPPING_LABEL_AND_PACKING_SLIP";
/** Link PDF label/packing slip (berlaku 24 jam). */
export async function shippingDocument(c: Ctx, packageId: string, type: DocType): Promise<{ url: string; trackingNo: string | null }> {
  const d = await call<{ doc_url: string; tracking_number?: string }>(`/fulfillment/202309/packages/${enc(packageId)}/shipping_documents`, {
    ...c,
    query: { document_type: type, document_size: "A6" },
  });
  return { url: d.doc_url, trackingNo: d.tracking_number || null };
}

export async function shippingProviders(c: Ctx, deliveryOptionId: string): Promise<{ id: string; name: string }[]> {
  const d = await call<{ shipping_providers?: { id: string; name: string }[] }>(`/logistics/202309/delivery_options/${enc(deliveryOptionId)}/shipping_providers`, c);
  return d.shipping_providers ?? [];
}

/** Kirim sendiri: tandai dikirim + resi. Kembalikan package id. */
export async function markShipped(c: Ctx, orderId: string, trackingNo: string, providerId: string): Promise<string | null> {
  const d = await call<{ package_id?: string }>(`/fulfillment/202610/orders/${enc(orderId)}/packages`, {
    ...c,
    method: "POST",
    body: { shipping_info_list: [{ tracking_number: trackingNo, shipping_provider_id: providerId }] },
  });
  return d?.package_id ?? null;
}

/** Ubah resi: per paket bila ada, kalau tidak per pesanan. */
export async function updateShipping(c: Ctx, ids: { orderId: string; packageId: string | null }, trackingNo: string, providerId: string): Promise<void> {
  if (ids.packageId) {
    await call(`/fulfillment/202610/packages/${enc(ids.packageId)}/shipping_info/update`, {
      ...c,
      method: "POST",
      body: { shipping_info_list: [{ tracking_number: trackingNo, shipping_provider_id: providerId }] },
    });
  } else {
    await call(`/fulfillment/202309/orders/${enc(ids.orderId)}/shipping_info/update`, { ...c, method: "POST", body: { tracking_number: trackingNo, shipping_provider_id: providerId } });
  }
}

export type TrackEvent = { at: Date; text: string; trackingNo: string | null; carrier: string | null };
/** Riwayat lacak paket; pakai API logistik terbaru, jatuh ke API fulfillment lama bila gagal. */
export async function orderTracking(c: Ctx, orderId: string): Promise<TrackEvent[]> {
  const out: TrackEvent[] = [];
  try {
    const d = await call<{ logistics_details?: { newest_tracking_no?: string; carrier_name?: string; track_list?: { description?: string; tracking_no?: string; update_time_millis?: number }[] }[] }>(
      `/logistics/202604/orders/${enc(orderId)}/tracking`,
      c,
    );
    for (const p of d.logistics_details ?? [])
      for (const t of p.track_list ?? [])
        out.push({ at: new Date(t.update_time_millis ?? 0), text: (t.description ?? "").trim(), trackingNo: t.tracking_no || p.newest_tracking_no || null, carrier: p.carrier_name || null });
  } catch {
    const d = await call<{ tracking?: { description?: string; update_time_millis?: number }[] }>(`/fulfillment/202309/orders/${enc(orderId)}/tracking`, c);
    for (const t of d.tracking ?? []) out.push({ at: new Date(t.update_time_millis ?? 0), text: (t.description ?? "").trim(), trackingNo: null, carrier: null });
  }
  return out.sort((a, b) => b.at.getTime() - a.at.getTime());
}

// ---------- kirim sendiri: status antar & bukti ----------

/** Upload bukti antar: gambar (JPG/PNG ≤5MB) atau PDF (≤10MB). */
export async function uploadProof(c: Ctx, file: Blob, name: string, pdf: boolean): Promise<string> {
  const d = pdf
    ? await upload<{ url: string }>(c, "/fulfillment/202309/files/upload", file, name, { name })
    : await upload<{ url: string }>(c, "/fulfillment/202309/images/upload", file, name);
  return d.url;
}

export async function deliveryStatus(
  c: Ctx,
  packageId: string,
  type: "DELIVERY_SUCCESS" | "DELIVERY_FAILED" | "UPDATE_POD",
  opt: { reason?: string; fileUrl?: string; fileType?: "IMG" | "PDF" } = {},
): Promise<void> {
  const d = await call<{ errors?: { message?: string }[] }>("/fulfillment/202309/packages/deliver", {
    ...c,
    method: "POST",
    body: {
      packages: [
        {
          id: packageId,
          delivery_type: type,
          ...(opt.reason ? { fail_delivery_reason: opt.reason } : {}),
          ...(opt.fileUrl ? { file_url: opt.fileUrl, file_type: opt.fileType ?? "IMG" } : {}),
        },
      ],
    },
  });
  batchErrors(d);
}

// ---------- faktur ----------
/** Upload faktur XML (base64, ≤1MB) ke paket. */
export async function uploadInvoice(c: Ctx, packageId: string, orderIds: string[], xmlBase64: string): Promise<void> {
  const d = await call<{ errors?: { message?: string }[] }>("/fulfillment/202502/invoice/upload", {
    ...c,
    method: "POST",
    body: { invoices: [{ package_id: packageId, order_ids: orderIds, file_type: "XML", file: xmlBase64 }] },
  });
  batchErrors(d);
}

// ---------- produk on/off ----------
/** Aktifkan / nonaktifkan produk (maks 20). `tokopedia`: produk toko migrasi Tokopedia → ikut di Tokopedia. */
export async function setProductsActive(c: Ctx, productIds: string[], active: boolean, tokopedia: boolean): Promise<void> {
  const d = await call<{ errors?: { message?: string }[] }>(`/product/202309/products/${active ? "activate" : "deactivate"}`, {
    ...c,
    method: "POST",
    body: { product_ids: productIds.slice(0, 20), ...(tokopedia ? { listing_platforms: ["TIKTOK_SHOP", "TOKOPEDIA"] } : {}) },
  });
  batchErrors(d);
}

// ---------- gudang & stok ----------
export type Warehouse = { id: string; name: string; status: string; type: string; isDefault: boolean; address: string | null; contact: string | null };
export async function warehouses(c: Ctx): Promise<Warehouse[]> {
  const d = await call<{
    warehouses?: { id: string; name: string; effect_status?: string; type?: string; is_default?: boolean; address?: { full_address?: string; city?: string; state?: string; contact_person?: string; phone_number?: string } }[];
  }>("/logistics/202309/warehouses", c);
  return (d.warehouses ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    status: w.effect_status ?? "",
    type: w.type ?? "",
    isDefault: !!w.is_default,
    address: [w.address?.full_address, w.address?.city, w.address?.state].filter(Boolean).join(", ") || null,
    contact: [w.address?.contact_person, w.address?.phone_number].filter(Boolean).join(" · ") || null,
  }));
}

export type DeliveryOption = { id: string; name: string; type: string; description: string | null; platforms: string[] };
export async function warehouseDeliveryOptions(c: Ctx, warehouseId: string): Promise<DeliveryOption[]> {
  const d = await call<{ delivery_options?: { id: string; name: string; type?: string; description?: string; platform?: string[] }[] }>(
    `/logistics/202309/warehouses/${enc(warehouseId)}/delivery_options`,
    { ...c, query: { scope: "WAREHOUSE" } },
  );
  return (d.delivery_options ?? []).map((o) => ({ id: o.id, name: o.name, type: o.type ?? "", description: o.description || null, platforms: o.platform ?? [] }));
}

export type SkuStock = { skuId: string; sellerSku: string | null; available: number; committed: number; warehouses: { id: string; available: number; committed: number }[] };
export async function inventory(c: Ctx, productIds: string[]): Promise<SkuStock[]> {
  const d = await call<{
    inventory?: {
      skus?: { id: string; seller_sku?: string; total_available_quantity?: number; total_committed_quantity?: number; warehouse_inventory?: { warehouse_id: string; available_quantity?: number; committed_quantity?: number }[] }[];
    }[];
  }>("/product/202309/inventory/search", { ...c, method: "POST", body: { product_ids: productIds.slice(0, 100) } });
  return (d.inventory ?? []).flatMap((p) =>
    (p.skus ?? []).map((s) => ({
      skuId: s.id,
      sellerSku: s.seller_sku || null,
      available: s.total_available_quantity ?? 0,
      committed: s.total_committed_quantity ?? 0,
      warehouses: (s.warehouse_inventory ?? []).map((w) => ({ id: w.warehouse_id, available: w.available_quantity ?? 0, committed: w.committed_quantity ?? 0 })),
    })),
  );
}

export async function activeShops(c: Ctx): Promise<{ id: string; region: string }[]> {
  const d = await call<{ shops?: { id: string; region: string }[] }>("/seller/202309/shops", { token: c.token });
  return d.shops ?? [];
}
