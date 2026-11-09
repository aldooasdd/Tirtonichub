// Retur / pengembalian dana Shopee (modul Returns).
import { call } from "./shopee";

type C = { token: string; shopId: string };
const f = (v: unknown) => Number(v) || 0;

export type ReturnItem = { itemId: string; modelId: string; name: string; image: string; qty: number; price: number; sku: string; refund: number };
export type ReturnRow = {
  sn: string;
  orderSn: string;
  status: string;
  reason: string;
  textReason: string;
  refund: number;
  created: number;
  updated: number;
  due: number;
  tracking: string;
  buyer: string;
  images: string[];
  items: ReturnItem[];
  negotiation: string;
  proof: string;
  compensation: string;
  needsLogistics: boolean;
  solution: number;
};
type RawItem = { item_id: number; model_id: number; name: string; images?: string[]; amount: number; item_price: number; item_sku?: string; variation_sku?: string; refund_amount?: number };
type Raw = {
  return_sn: string;
  order_sn: string;
  status: string;
  reason?: string;
  text_reason?: string;
  refund_amount?: number;
  create_time?: number;
  update_time?: number;
  due_date?: number;
  tracking_number?: string;
  user?: { username?: string };
  image?: string[];
  item?: RawItem[];
  negotiation_status?: string;
  seller_proof_status?: string;
  seller_compensation_status?: string;
  needs_logistics?: boolean;
  return_solution?: number;
};
const toRow = (r: Raw): ReturnRow => ({
  sn: r.return_sn,
  orderSn: r.order_sn,
  status: r.status,
  reason: r.reason ?? "",
  textReason: r.text_reason ?? "",
  refund: f(r.refund_amount),
  created: f(r.create_time),
  updated: f(r.update_time),
  due: f(r.due_date),
  tracking: r.tracking_number ?? "",
  buyer: r.user?.username ?? "",
  images: r.image ?? [],
  items: (r.item ?? []).map((i) => ({
    itemId: String(i.item_id),
    modelId: String(i.model_id),
    name: i.name,
    image: i.images?.[0] ?? "",
    qty: f(i.amount),
    price: f(i.item_price),
    sku: i.variation_sku || i.item_sku || "",
    refund: f(i.refund_amount ?? i.item_price),
  })),
  negotiation: r.negotiation_status ?? "",
  proof: r.seller_proof_status ?? "",
  compensation: r.seller_compensation_status ?? "",
  needsLogistics: !!r.needs_logistics,
  solution: f(r.return_solution),
});

/** Daftar retur (berdasar waktu dibuat, maks 15 hari per rentang). */
export async function returnList(c: C, from: number, to: number, status?: string): Promise<ReturnRow[]> {
  const out: ReturnRow[] = [];
  for (let page = 0; page < 50; page++) {
    const j = await call<{ response?: { return?: Raw[]; more?: boolean } }>("/api/v2/returns/get_return_list", {
      ...c,
      query: { page_no: page, page_size: 100, create_time_from: from, create_time_to: to, ...(status ? { status } : {}) },
    });
    out.push(...(j.response?.return ?? []).map(toRow));
    if (!j.response?.more) break;
  }
  return out;
}

export type ReturnDetail = ReturnRow & {
  videos: { url: string; thumb: string }[];
  negotiationInfo: { status: string; solution: string; offer: number; by: string; counterLeft: number; due: number } | null;
  proofDeadline: number;
  compensationAmount: number;
  logisticsStatus: string;
  carrier: string;
  pickup: string;
};

export async function returnDetail(c: C, sn: string): Promise<ReturnDetail> {
  type D = Raw & {
    buyer_videos?: { thumbnail_url: string; video_url: string }[];
    negotiation?: { negotiation_status?: string; latest_solution?: string; latest_offer_amount?: number; latest_offer_creator?: string; counter_limit?: number; offer_due_date?: number };
    seller_proof?: { seller_proof_status?: string; seller_evidence_deadline?: number };
    seller_compensation?: { seller_compensation_status?: string; compensation_amount?: number };
    reverse_logistics_status?: string;
    logistics_status?: string;
    reverse_logistics_channel_name?: string;
    return_pickup_address?: { name?: string; address?: string; city?: string };
  };
  const j = await call<{ response?: D }>("/api/v2/returns/get_return_detail", { ...c, query: { return_sn: sn } });
  const r = j.response;
  if (!r) throw new Error("Retur tidak ditemukan.");
  const n = r.negotiation;
  return {
    ...toRow({ ...r, negotiation_status: r.negotiation_status ?? n?.negotiation_status, seller_proof_status: r.seller_proof?.seller_proof_status, seller_compensation_status: r.seller_compensation?.seller_compensation_status }),
    videos: (r.buyer_videos ?? []).map((v) => ({ url: v.video_url, thumb: v.thumbnail_url })),
    negotiationInfo: n
      ? { status: n.negotiation_status ?? "", solution: n.latest_solution ?? "", offer: f(n.latest_offer_amount), by: n.latest_offer_creator ?? "", counterLeft: f(n.counter_limit), due: f(n.offer_due_date) }
      : null,
    proofDeadline: f(r.seller_proof?.seller_evidence_deadline),
    compensationAmount: f(r.seller_compensation?.compensation_amount),
    logisticsStatus: r.reverse_logistics_status ?? r.logistics_status ?? "",
    carrier: r.reverse_logistics_channel_name ?? "",
    pickup: [r.return_pickup_address?.name, r.return_pickup_address?.address, r.return_pickup_address?.city].filter(Boolean).join(", "),
  };
}

export type Solutions = { returnRefund: { ok: boolean; min: number; max: number; adjustable: boolean }; refund: { ok: boolean; min: number; max: number; adjustable: boolean } };
export async function availableSolutions(c: C, sn: string): Promise<Solutions> {
  type O = { eligibility?: boolean; refund_amount_adjustable?: boolean; max_refund_amount?: number; min_refund_amount?: number };
  const j = await call<{ response?: { offer_return_refund?: O; offer_refund?: O } }>("/api/v2/returns/get_available_solutions", { ...c, query: { return_sn: sn } });
  const m = (o?: O) => ({ ok: !!o?.eligibility, adjustable: !!o?.refund_amount_adjustable, min: f(o?.min_refund_amount), max: f(o?.max_refund_amount) });
  return { returnRefund: m(j.response?.offer_return_refund), refund: m(j.response?.offer_refund) };
}

export type DisputeReason = { id: string; reason: string; requirement: string; modules: { index: number; requirement: string; required: boolean }[] };
export async function disputeReasons(c: C, sn: string): Promise<DisputeReason[]> {
  type R = { dispute_reason_id?: number; dispute_reason: string | number; dispute_requirement?: string; evidence_module_list?: { module_index: number; requirement: string; is_required: boolean }[] };
  const j = await call<{ response?: { dispute_reason_list?: R[] } }>("/api/v2/returns/get_return_dispute_reason", { ...c, query: { return_sn: sn } });
  return (j.response?.dispute_reason_list ?? []).map((r) => ({
    id: String(r.dispute_reason_id ?? r.dispute_reason),
    reason: String(r.dispute_reason),
    requirement: r.dispute_requirement ?? "",
    modules: (r.evidence_module_list ?? []).map((m) => ({ index: m.module_index, requirement: m.requirement, required: m.is_required })),
  }));
}

export async function reverseTracking(c: C, sn: string): Promise<{ status: string; tracking: string; events: { time: number; text: string }[] }> {
  type T = { update_time: number; tracking_description: string };
  const j = await call<{ response?: { reverse_logistics_status?: string; tracking_number?: string; tracking_info?: T[]; post_return_logistics_tracking_info?: T[] } }>(
    "/api/v2/returns/get_reverse_tracking_info",
    { ...c, query: { return_sn: sn } },
  );
  const ev = [...(j.response?.tracking_info ?? []), ...(j.response?.post_return_logistics_tracking_info ?? [])].map((t) => ({ time: f(t.update_time), text: t.tracking_description }));
  return { status: j.response?.reverse_logistics_status ?? "", tracking: j.response?.tracking_number ?? "", events: ev.sort((a, b) => b.time - a.time) };
}

// ── Aksi ──
export const confirmReturn = (c: C, sn: string) => call("/api/v2/returns/confirm", { ...c, method: "POST", body: { return_sn: sn } });
export const acceptOffer = (c: C, sn: string) => call("/api/v2/returns/accept_offer", { ...c, method: "POST", body: { return_sn: sn } });
// ponytail: nilai proposed_solution dari Data Definition (tak bisa diambil otomatis); Shopee menolak kalau salah → pesan error tampil di UI.
export const offerReturn = (c: C, sn: string, solution: "return_refund" | "refund", amount?: number) =>
  call("/api/v2/returns/offer", { ...c, method: "POST", body: { return_sn: sn, proposed_solution: solution, ...(amount != null ? { proposed_adjusted_refund_amount: amount } : {}) } });

export async function disputeReturn(c: C, d: { sn: string; email: string; reasonId: string; text?: string; images?: { index: number; requirement: string; urls: string[] }[] }) {
  return call("/api/v2/returns/dispute", {
    ...c,
    method: "POST",
    body: {
      return_sn: d.sn,
      email: d.email,
      dispute_reason_id: Number(d.reasonId),
      ...(d.text ? { dispute_text_reason: d.text } : {}),
      ...(d.images?.length ? { image_list: d.images.map((i) => ({ module_index: i.index, requirement: i.requirement, image_url: i.urls })) } : {}),
    },
  });
}

/** Upload foto bukti → url + thumbnail untuk upload_proof / dispute. */
export async function convertImage(c: C, sn: string, file: Blob, name: string): Promise<{ url: string; thumbnail: string }> {
  const form = new FormData();
  form.set("return_sn", sn);
  form.set("upload_image", file, name);
  const j = await call<{ response?: { url?: string; thumbnail?: string } }>("/api/v2/returns/convert_image", { ...c, form });
  if (!j.response?.url) throw new Error("Upload foto gagal.");
  return { url: j.response.url, thumbnail: j.response.thumbnail ?? j.response.url };
}

export const uploadProof = (c: C, sn: string, photos: { url: string; thumbnail: string }[], description?: string) =>
  call("/api/v2/returns/upload_proof", { ...c, method: "POST", body: { return_sn: sn, photo: photos, ...(description ? { description } : {}) } });
