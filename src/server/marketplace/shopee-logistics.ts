// Pengiriman & aksi pesanan Shopee: atur kirim, label/AWB, lacak, batal, catatan, alamat & kurir.
import { call, callFile } from "./shopee";

type C = { token: string; shopId: string };
const f = (v: unknown) => Number(v) || 0;

export type ShipParam = {
  needed: { pickup: string[]; dropoff: string[]; nonIntegrated: string[] };
  addresses: { id: string; text: string; flags: string[]; slots: { id: string; date: number; text: string; recommended: boolean }[] }[];
  branches: { id: string; text: string }[];
};

export async function shippingParameter(c: C, orderSn: string): Promise<ShipParam> {
  type A = { address_id: number; address: string; city?: string; district?: string; state?: string; zipcode?: string; address_flag?: string[]; time_slot_list?: { date: number; time_text?: string; pickup_time_id: string; flags?: string[] }[] };
  type B = { branch_id: number; address: string; city?: string; district?: string };
  const j = await call<{ response?: { info_needed?: { pickup?: string[]; dropoff?: string[]; non_integrated?: string[] }; pickup?: { address_list?: A[] }; dropoff?: { branch_list?: B[] } } }>(
    "/api/v2/logistics/get_shipping_parameter",
    { ...c, query: { order_sn: orderSn } },
  );
  const r = j.response ?? {};
  return {
    needed: { pickup: r.info_needed?.pickup ?? [], dropoff: r.info_needed?.dropoff ?? [], nonIntegrated: r.info_needed?.non_integrated ?? [] },
    addresses: (r.pickup?.address_list ?? []).map((a) => ({
      id: String(a.address_id),
      text: [a.address, a.district, a.city, a.state, a.zipcode].filter(Boolean).join(", "),
      flags: a.address_flag ?? [],
      slots: (a.time_slot_list ?? []).map((t) => ({ id: t.pickup_time_id, date: f(t.date), text: t.time_text ?? "", recommended: (t.flags ?? []).includes("recommended") })),
    })),
    branches: (r.dropoff?.branch_list ?? []).map((b) => ({ id: String(b.branch_id), text: [b.address, b.district, b.city].filter(Boolean).join(", ") })),
  };
}

export type ShipChoice =
  | { mode: "pickup"; addressId: string; timeId?: string; tracking?: string }
  | { mode: "dropoff"; branchId?: string; sender?: string; tracking?: string }
  | { mode: "non_integrated"; tracking?: string };

const shipBody = (s: ShipChoice) =>
  s.mode === "pickup"
    ? { pickup: { address_id: Number(s.addressId), ...(s.timeId ? { pickup_time_id: s.timeId } : {}), ...(s.tracking ? { tracking_number: s.tracking } : {}) } }
    : s.mode === "dropoff"
      ? { dropoff: { ...(s.branchId ? { branch_id: Number(s.branchId) } : {}), ...(s.sender ? { sender_real_name: s.sender } : {}), ...(s.tracking ? { tracking_number: s.tracking } : {}) } }
      : { non_integrated: s.tracking ? { tracking_number: s.tracking } : {} };

export async function shipOrder(c: C, orderSn: string, s: ShipChoice): Promise<void> {
  await call("/api/v2/logistics/ship_order", { ...c, method: "POST", body: { order_sn: orderSn, ...shipBody(s) } });
}

export async function trackingNumber(c: C, orderSn: string): Promise<string> {
  const j = await call<{ response?: { tracking_number?: string } }>("/api/v2/logistics/get_tracking_number", { ...c, query: { order_sn: orderSn } });
  return j.response?.tracking_number ?? "";
}

export async function trackingInfo(c: C, orderSn: string): Promise<{ status: string; events: { time: number; text: string; status: string }[] }> {
  const j = await call<{ response?: { logistics_status?: string; tracking_info?: { update_time: number; description: string; logistics_status?: string }[] } }>(
    "/api/v2/logistics/get_tracking_info",
    { ...c, query: { order_sn: orderSn } },
  );
  return {
    status: j.response?.logistics_status ?? "",
    events: (j.response?.tracking_info ?? []).map((t) => ({ time: f(t.update_time), text: t.description, status: t.logistics_status ?? "" })).sort((a, b) => b.time - a.time),
  };
}

/** Label/AWB: siapkan → tunggu siap → unduh PDF (maks 50 pesanan sekurir). */
export async function shippingLabel(c: C, orderSns: string[]): Promise<{ data: ArrayBuffer; type: string }> {
  const list = orderSns.slice(0, 50).map((order_sn) => ({ order_sn }));
  const p = await call<{ response?: { result_list?: { order_sn: string; suggest_shipping_document_type?: string; fail_message?: string }[] } }>(
    "/api/v2/logistics/get_shipping_document_parameter",
    { ...c, method: "POST", body: { order_list: list } },
  );
  const res = p.response?.result_list ?? [];
  const fail = res.find((r) => r.fail_message);
  if (fail && res.length === 1) throw new Error(fail.fail_message);
  const type = res.find((r) => r.suggest_shipping_document_type)?.suggest_shipping_document_type ?? "THERMAL_AIR_WAYBILL";
  const withTracking = await Promise.all(list.map(async (o) => ({ ...o, tracking_number: (await trackingNumber(c, o.order_sn).catch(() => "")) || undefined, shipping_document_type: type })));
  const cr = await call<{ response?: { result_list?: { fail_message?: string }[] } }>("/api/v2/logistics/create_shipping_document", { ...c, method: "POST", body: { order_list: withTracking } });
  const cf = cr.response?.result_list?.find((r) => r.fail_message);
  if (cf && list.length === 1) throw new Error(cf.fail_message);
  for (let i = 0; i < 10; i++) {
    const r = await call<{ response?: { result_list?: { status: string; fail_message?: string }[] } }>("/api/v2/logistics/get_shipping_document_result", {
      ...c,
      method: "POST",
      body: { order_list: list.map((o) => ({ ...o, shipping_document_type: type })) },
    });
    const st = r.response?.result_list ?? [];
    if (st.length && st.every((x) => x.status !== "PROCESSING")) {
      if (st.every((x) => x.status === "FAILED")) throw new Error(st[0].fail_message || "Label gagal dibuat.");
      break;
    }
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return callFile("/api/v2/logistics/download_shipping_document", { ...c, body: { shipping_document_type: type, order_list: list } });
}

export const CANCEL_REASONS = { OUT_OF_STOCK: "Stok habis", CUSTOMER_REQUEST: "Permintaan pembeli", UNDELIVERABLE_AREA: "Area tidak terjangkau" } as const;
export type CancelReason = keyof typeof CANCEL_REASONS;

export async function cancelOrder(c: C, orderSn: string, reason: CancelReason, items?: { itemId: string; modelId: string }[]): Promise<void> {
  await call("/api/v2/order/cancel_order", {
    ...c,
    method: "POST",
    body: { order_sn: orderSn, cancel_reason: reason, ...(reason === "OUT_OF_STOCK" && items?.length ? { item_list: items.map((i) => ({ item_id: Number(i.itemId), model_id: Number(i.modelId) })) } : {}) },
  });
}

export async function handleBuyerCancellation(c: C, orderSn: string, accept: boolean): Promise<void> {
  await call("/api/v2/order/handle_buyer_cancellation", { ...c, method: "POST", body: { order_sn: orderSn, operation: accept ? "ACCEPT" : "REJECT" } });
}

export async function setNote(c: C, orderSn: string, note: string): Promise<void> {
  await call("/api/v2/order/set_note", { ...c, method: "POST", body: { order_sn: orderSn, note } });
}

export async function orderInfo(c: C, orderSn: string): Promise<{ note: string; items: { itemId: string; modelId: string; name: string; qty: number }[]; cancelBy: string; cancelReason: string }> {
  type I = { item_id: number; model_id: number; item_name: string; model_quantity_purchased: number };
  const j = await call<{ response?: { order_list?: { note?: string; item_list?: I[]; cancel_by?: string; cancel_reason?: string; buyer_cancel_reason?: string }[] } }>(
    "/api/v2/order/get_order_detail",
    { ...c, query: { order_sn_list: orderSn, response_optional_fields: "note,item_list,cancel_by,cancel_reason,buyer_cancel_reason" } },
  );
  const o = j.response?.order_list?.[0];
  return {
    note: o?.note ?? "",
    items: (o?.item_list ?? []).map((i) => ({ itemId: String(i.item_id), modelId: String(i.model_id), name: i.item_name, qty: f(i.model_quantity_purchased) })),
    cancelBy: o?.cancel_by ?? "",
    cancelReason: o?.buyer_cancel_reason || o?.cancel_reason || "",
  };
}

export async function addressList(c: C): Promise<{ id: string; text: string; types: string[] }[]> {
  type A = { address_id: number; address: string; city?: string; district?: string; state?: string; zipcode?: string; address_type?: string[] };
  const j = await call<{ response?: { address_list?: A[] } }>("/api/v2/logistics/get_address_list", c);
  return (j.response?.address_list ?? []).map((a) => ({ id: String(a.address_id), text: [a.address, a.district, a.city, a.state, a.zipcode].filter(Boolean).join(", "), types: a.address_type ?? [] }));
}

export async function channelList(c: C): Promise<{ id: string; name: string; enabled: boolean; cod: boolean; maxWeight: number; preprint: boolean; service: string; desc: string }[]> {
  type L = {
    logistics_channel_id: number;
    logistics_channel_name: string;
    enabled: boolean;
    cod_enabled?: boolean;
    weight_limit?: { item_max_weight?: number };
    preprint?: boolean;
    service_type_identifier?: string;
    logistics_description?: string;
  };
  const j = await call<{ response?: { logistics_channel_list?: L[] } }>("/api/v2/logistics/get_channel_list", c);
  return (j.response?.logistics_channel_list ?? []).map((l) => ({
    id: String(l.logistics_channel_id),
    name: l.logistics_channel_name,
    enabled: !!l.enabled,
    cod: !!l.cod_enabled,
    maxWeight: f(l.weight_limit?.item_max_weight),
    preprint: !!l.preprint,
    service: l.service_type_identifier ?? "",
    desc: l.logistics_description ?? "",
  }));
}
