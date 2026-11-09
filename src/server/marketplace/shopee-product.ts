// Produk Shopee: ulasan & balasan, statistik, pelanggaran, diagnosis konten, promo, naikkan produk,
// arsip/hapus/ubah (yang mengubah Shopee tetap ikut saklar PRODUK_KE_MARKETPLACE).
import { call } from "./shopee";
import { PRODUK_KE_MARKETPLACE, PRODUK_OFF_MSG } from "@/lib/flags";

type C = { token: string; shopId: string };
const f = (v: unknown) => Number(v) || 0;
const guard = () => {
  if (!PRODUK_KE_MARKETPLACE) throw new Error(PRODUK_OFF_MSG);
};

export type Review = {
  id: string;
  orderSn: string;
  itemId: string;
  buyer: string;
  rating: number;
  text: string;
  time: number;
  hidden: boolean;
  reply: string;
  replyTime: number;
  images: string[];
  videos: string[];
};

/** Ulasan pembeli (1 produk atau seluruh toko), terbaru dulu. */
export async function reviews(c: C, opts: { itemId?: string; max?: number } = {}): Promise<Review[]> {
  type R = {
    comment_id: string | number;
    order_sn?: string;
    item_id: number;
    buyer_username?: string;
    rating_star: number;
    comment?: string;
    create_time: number;
    hidden?: boolean;
    comment_reply?: { reply?: string; create_time?: number };
    media?: { image_url_list?: string[]; video_url_list?: string[] };
  };
  const out: Review[] = [];
  let cursor = "";
  for (let i = 0; i < 30 && out.length < (opts.max ?? 500); i++) {
    const j = await call<{ response?: { item_comment_list?: R[]; more?: boolean; next_cursor?: string } }>("/api/v2/product/get_comment", {
      ...c,
      query: { cursor, page_size: 100, ...(opts.itemId ? { item_id: opts.itemId } : {}) },
    });
    for (const r of j.response?.item_comment_list ?? [])
      out.push({
        id: String(r.comment_id),
        orderSn: r.order_sn ?? "",
        itemId: String(r.item_id),
        buyer: r.buyer_username ?? "",
        rating: f(r.rating_star),
        text: r.comment ?? "",
        time: f(r.create_time),
        hidden: !!r.hidden,
        reply: r.comment_reply?.reply ?? "",
        replyTime: f(r.comment_reply?.create_time),
        images: r.media?.image_url_list ?? [],
        videos: r.media?.video_url_list ?? [],
      });
    cursor = j.response?.next_cursor ?? "";
    if (!j.response?.more || !cursor) break;
  }
  return out.sort((a, b) => b.time - a.time);
}

export async function replyReviews(c: C, list: { id: string; text: string }[]): Promise<string[]> {
  const j = await call<{ response?: { result_list?: { comment_id: number; fail_message?: string; fail_error?: string }[] } }>("/api/v2/product/reply_comment", {
    ...c,
    method: "POST",
    body: { comment_list: list.map((x) => ({ comment_id: Number(x.id), comment: x.text })) },
  });
  return (j.response?.result_list ?? []).filter((r) => r.fail_error || r.fail_message).map((r) => `${r.comment_id}: ${r.fail_message || r.fail_error}`);
}

export type ExtraInfo = { itemId: string; sale: number; views: number; likes: number; rating: number; comments: number };
export async function extraInfo(c: C, itemIds: string[]): Promise<ExtraInfo[]> {
  const out: ExtraInfo[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const j = await call<{ response?: { item_list?: { item_id: number; sale: number; views: number; likes: number; rating_star: number; comment_count: number }[] } }>(
      "/api/v2/product/get_item_extra_info",
      { ...c, query: { item_id_list: itemIds.slice(i, i + 50).join(",") } },
    );
    for (const x of j.response?.item_list ?? [])
      out.push({ itemId: String(x.item_id), sale: f(x.sale), views: f(x.views), likes: f(x.likes), rating: f(x.rating_star), comments: f(x.comment_count) });
  }
  return out;
}

export type Violation = { itemId: string; name: string; status: string; deboost: boolean; issues: { type: string; reason: string; suggestion: string; deadline: number; deboost: boolean }[] };
export async function violations(c: C, itemIds: string[]): Promise<Violation[]> {
  type D = { violation_type: string; violation_reason: string; suggestion: string; fix_deadline_time?: number };
  type I = { item_id: number; item_name?: string; item_status?: string; deboost?: boolean; item_status_details?: D[]; deboost_details?: D[] };
  const out: Violation[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const j = await call<{ response?: { item_list?: I[] } }>("/api/v2/product/get_item_violation_info", { ...c, query: { item_id_list: itemIds.slice(i, i + 50).join(",") } });
    for (const x of j.response?.item_list ?? []) {
      const m = (d: D, deboost: boolean) => ({ type: d.violation_type, reason: d.violation_reason, suggestion: d.suggestion, deadline: f(d.fix_deadline_time), deboost });
      out.push({
        itemId: String(x.item_id),
        name: x.item_name ?? "",
        status: x.item_status ?? "",
        deboost: !!x.deboost,
        issues: [...(x.item_status_details ?? []).map((d) => m(d, false)), ...(x.deboost_details ?? []).map((d) => m(d, true))],
      });
    }
  }
  return out;
}

const QUALITY: Record<number, string> = { 0: "-", 1: "Kurang", 2: "Cukup", 3: "Bagus" };
export async function diagnosis(c: C, itemIds: string[]): Promise<{ itemId: string; quality: string; tasks: string[] }[]> {
  const out: { itemId: string; quality: string; tasks: string[] }[] = [];
  for (let i = 0; i < itemIds.length; i += 48) {
    const j = await call<{ response?: { success_item_list?: { item_id: number; quality_level: number; unfinished_task?: { suggestion: string }[] }[] } }>(
      "/api/v2/product/get_item_content_diagnosis_result",
      { ...c, method: "POST", body: { item_id_list: itemIds.slice(i, i + 48).map(Number) } },
    );
    for (const x of j.response?.success_item_list ?? [])
      out.push({ itemId: String(x.item_id), quality: QUALITY[x.quality_level] ?? String(x.quality_level), tasks: (x.unfinished_task ?? []).map((t) => t.suggestion) });
  }
  return out;
}

export type Promo = { itemId: string; type: string; id: string; modelId: string; start: number; end: number; stage: string; price: number };
export async function promotions(c: C, itemIds: string[]): Promise<Promo[]> {
  type P = { promotion_type: string; promotion_id: number; model_id?: number; start_time: number; end_time: number; promotion_staging?: string; promotion_price_info?: { promotion_price?: number }[] };
  const out: Promo[] = [];
  for (let i = 0; i < itemIds.length; i += 50) {
    const j = await call<{ response?: { success_list?: { item_id: number; promotion?: P[] }[] } }>("/api/v2/product/get_item_promotion", {
      ...c,
      query: { item_id_list: itemIds.slice(i, i + 50).join(",") },
    });
    for (const x of j.response?.success_list ?? [])
      for (const p of x.promotion ?? [])
        out.push({
          itemId: String(x.item_id),
          type: p.promotion_type,
          id: String(p.promotion_id),
          modelId: String(p.model_id ?? ""),
          start: f(p.start_time),
          end: f(p.end_time),
          stage: p.promotion_staging ?? "",
          price: f(p.promotion_price_info?.[0]?.promotion_price),
        });
  }
  return out;
}

/** Naikkan produk (maks 5 sekaligus; tiap produk ada jeda 4 jam dari Shopee). */
export async function boost(c: C, itemIds: string[]): Promise<string[]> {
  const j = await call<{ response?: { failure_list?: { item_id: number; failed_reason: string }[] } }>("/api/v2/product/boost_item", {
    ...c,
    method: "POST",
    body: { item_id_list: itemIds.slice(0, 5).map(Number) },
  });
  return (j.response?.failure_list ?? []).map((x) => `${x.item_id}: ${x.failed_reason}`);
}
export async function boosted(c: C): Promise<{ itemId: string; cooldown: number }[]> {
  const j = await call<{ response?: { item_list?: { item_id: number; cool_down_second: number }[] } }>("/api/v2/product/get_boosted_list", c);
  return (j.response?.item_list ?? []).map((x) => ({ itemId: String(x.item_id), cooldown: f(x.cool_down_second) }));
}

// ── Mengubah produk di Shopee (ikut saklar) ──
export async function unlist(c: C, itemId: string, off: boolean): Promise<void> {
  guard();
  const j = await call<{ response?: { failure_list?: { failed_reason: string }[] } }>("/api/v2/product/unlist_item", {
    ...c,
    method: "POST",
    body: { item_list: [{ item_id: Number(itemId), unlist: off }] },
  });
  const fail = j.response?.failure_list?.[0];
  if (fail) throw new Error(fail.failed_reason);
}
export async function deleteItem(c: C, itemId: string): Promise<void> {
  guard();
  await call("/api/v2/product/delete_item", { ...c, method: "POST", body: { item_id: Number(itemId) } });
}
/** Ubah nama / deskripsi produk. */
export async function updateItem(c: C, itemId: string, d: { name?: string; description?: string }): Promise<void> {
  guard();
  await call("/api/v2/product/update_item", {
    ...c,
    method: "POST",
    body: { item_id: Number(itemId), ...(d.name ? { item_name: d.name } : {}), ...(d.description ? { description: d.description } : {}) },
  });
}
/** Tambah produk baru (body mentah sesuai v2.product.add_item). */
export async function addItem(c: C, body: Record<string, unknown>): Promise<string> {
  guard();
  const j = await call<{ response?: { item_id?: number } }>("/api/v2/product/add_item", { ...c, method: "POST", body });
  return String(j.response?.item_id ?? "");
}
