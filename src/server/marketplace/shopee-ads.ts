// Shopee Ads lanjutan: per jam, pengaturan iklan, GMV Max, rekomendasi, buat/ubah iklan.
// Tanggal "DD-MM-YYYY". Perubahan iklan = uang sungguhan → selalu lewat konfirmasi di UI.
import { randomUUID } from "node:crypto";
import { call } from "./shopee";

type C = { token: string; shopId: string };
const f = (v: unknown) => Number(v) || 0;
const ref = () => randomUUID();
/** Shopee kadang balas objek, kadang array objek → selalu array. */
const arr = <T>(v: T | T[] | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);

export type Metric = { impression: number; clicks: number; expense: number; order: number; gmv: number; roas: number };
type RawM = { impression?: number; clicks?: number; expense?: number; broad_order?: number; broad_gmv?: number; broad_roi?: number; broad_roas?: number };
const metric = (m: RawM | undefined): Metric => ({
  impression: f(m?.impression),
  clicks: f(m?.clicks),
  expense: f(m?.expense),
  order: f(m?.broad_order),
  gmv: f(m?.broad_gmv),
  roas: f(m?.broad_roi ?? m?.broad_roas),
});

/** Performa semua iklan CPC per jam pada 1 tanggal. */
export async function hourlyAll(c: C, date: string): Promise<(Metric & { hour: number })[]> {
  const j = await call<{ response?: (RawM & { hour: number })[] }>("/api/v2/ads/get_all_cpc_ads_hourly_performance", { ...c, query: { performance_date: date } });
  return arr(j.response).map((m) => ({ hour: f(m.hour), ...metric(m) })).sort((a, b) => a.hour - b.hour);
}

/** Performa 1 iklan produk per jam pada 1 tanggal. */
export async function hourlyCampaign(c: C, date: string, campaignId: string): Promise<(Metric & { hour: number })[]> {
  type R = { campaign_list?: { metrics_list?: (RawM & { hour: number })[] }[] };
  const j = await call<{ response?: R | R[] }>("/api/v2/ads/get_product_campaign_hourly_performance", {
    ...c,
    query: { performance_date: date, campaign_id_list: campaignId },
  });
  return arr(j.response)
    .flatMap((r) => r.campaign_list ?? [])
    .flatMap((x) => x.metrics_list ?? [])
    .map((m) => ({ hour: f(m.hour), ...metric(m) }))
    .sort((a, b) => a.hour - b.hour);
}

/** Performa harian 1 iklan produk. */
export async function dailyCampaign(c: C, start: string, end: string, campaignId: string): Promise<(Metric & { date: string })[]> {
  type R = { campaign_list?: { metrics_list?: (RawM & { date: string })[] }[] };
  const j = await call<{ response?: R | R[] }>("/api/v2/ads/get_product_campaign_daily_performance", {
    ...c,
    query: { start_date: start, end_date: end, campaign_id_list: campaignId },
  });
  return arr(j.response).flatMap((r) => r.campaign_list ?? []).flatMap((x) => x.metrics_list ?? []).map((m) => ({ date: m.date, ...metric(m) }));
}

export type Keyword = { keyword: string; status: string; match: string; bid: number };
export type CampaignSetting = {
  id: string;
  name: string;
  type: string;
  status: string;
  bidding: string;
  placement: string;
  budget: number;
  start: number;
  end: number;
  itemIds: string[];
  enhancedCpc: boolean;
  keywords: Keyword[];
  locations: { location: string; status: string; bid: number }[];
  roasTarget: number;
  autoProducts: { itemId: string; name: string; status: string }[];
};

/** Pengaturan iklan produk (budget, durasi, keyword, target ROAS, produk). */
export async function campaignSettings(c: C, ids: string[]): Promise<CampaignSetting[]> {
  type R = {
    campaign_id: number;
    common_info?: {
      ad_type?: string;
      ad_name?: string;
      campaign_status?: string;
      bidding_method?: string;
      campaign_placement?: string;
      campaign_budget?: number;
      campaign_duration?: { start_time?: number; end_time?: number };
      item_id_list?: number[];
    };
    manual_bidding_info?: {
      enhanced_cpc?: boolean;
      selected_keywords?: { keyword: string; status: string; match_type: string; bid_price_per_click: number }[];
      discovery_ads_locations?: { location: string; status: string; bid_price: number }[];
    };
    auto_bidding_info?: { roas_target?: number };
    auto_product_ads_info?: { product_name: string; status: string; item_id: number }[];
  };
  const out: CampaignSetting[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const j = await call<{ response?: { campaign_list?: R[] } }>("/api/v2/ads/get_product_level_campaign_setting_info", {
      ...c,
      query: { info_type_list: "1,2,3,4", campaign_id_list: ids.slice(i, i + 100).join(",") },
    });
    for (const r of j.response?.campaign_list ?? []) {
      const ci = r.common_info ?? {};
      out.push({
        id: String(r.campaign_id),
        name: ci.ad_name ?? String(r.campaign_id),
        type: ci.ad_type ?? "",
        status: ci.campaign_status ?? "",
        bidding: ci.bidding_method ?? "",
        placement: ci.campaign_placement ?? "",
        budget: f(ci.campaign_budget),
        start: f(ci.campaign_duration?.start_time),
        end: f(ci.campaign_duration?.end_time),
        itemIds: (ci.item_id_list ?? []).map(String),
        enhancedCpc: !!r.manual_bidding_info?.enhanced_cpc,
        keywords: (r.manual_bidding_info?.selected_keywords ?? []).map((k) => ({ keyword: k.keyword, status: k.status, match: k.match_type, bid: f(k.bid_price_per_click) })),
        locations: (r.manual_bidding_info?.discovery_ads_locations ?? []).map((l) => ({ location: l.location, status: l.status, bid: f(l.bid_price) })),
        roasTarget: f(r.auto_bidding_info?.roas_target),
        autoProducts: (r.auto_product_ads_info ?? []).map((p) => ({ itemId: String(p.item_id), name: p.product_name, status: p.status })),
      });
    }
  }
  return out;
}

/** Semua ID iklan produk. */
export async function campaignIds(c: C): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; offset < 50_000; offset += 5000) {
    const j = await call<{ response?: { has_next_page?: boolean; campaign_list?: { campaign_id: number }[] } }>("/api/v2/ads/get_product_level_campaign_id_list", {
      ...c,
      query: { ad_type: "all", offset, limit: 5000 },
    });
    ids.push(...(j.response?.campaign_list ?? []).map((x) => String(x.campaign_id)));
    if (!j.response?.has_next_page) break;
  }
  return ids;
}

// ── GMV Max (GMS) ──
export async function gmsEligibility(c: C): Promise<{ eligible: boolean; reason: string }> {
  const j = await call<{ response?: { is_eligible?: boolean; reason?: string } }>("/api/v2/ads/check_create_gms_product_campaign_eligibility", c);
  return { eligible: !!j.response?.is_eligible, reason: j.response?.reason ?? "" };
}

export async function gmsCampaign(c: C, start: string, end: string): Promise<{ campaignId: string; report: Metric } | null> {
  const j = await call<{ response?: { campaign_id?: number; report?: RawM } }>("/api/v2/ads/get_gms_campaign_performance", {
    ...c,
    method: "POST",
    body: { start_date: start, end_date: end },
  });
  if (!j.response?.campaign_id && !j.response?.report) return null;
  return { campaignId: String(j.response.campaign_id ?? ""), report: metric(j.response.report) };
}

export async function gmsItems(c: C, start: string, end: string): Promise<(Metric & { itemId: string })[]> {
  const out: (Metric & { itemId: string })[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const j = await call<{ response?: { result_list?: { item_id: number; report?: RawM }[]; has_next_page?: boolean } }>("/api/v2/ads/get_gms_item_performance", {
      ...c,
      method: "POST",
      body: { start_date: start, end_date: end, offset, limit: 100 },
    });
    for (const r of j.response?.result_list ?? []) out.push({ itemId: String(r.item_id), ...metric(r.report) });
    if (!j.response?.has_next_page) break;
  }
  return out;
}

export async function createGms(c: C, d: { start: string; end?: string; dailyBudget: number; roasTarget?: number }): Promise<string> {
  const j = await call<{ response?: { campaign_id?: number } }>("/api/v2/ads/create_gms_product_campaign", {
    ...c,
    method: "POST",
    body: { start_date: d.start, ...(d.end ? { end_date: d.end } : {}), daily_budget: d.dailyBudget, reference_id: ref(), ...(d.roasTarget != null ? { roas_target: d.roasTarget } : {}) },
  });
  return String(j.response?.campaign_id ?? "");
}

export type GmsEdit = "change_budget" | "change_duration" | "pause" | "resume" | "start" | "change_roas_target";
export async function editGms(c: C, campaignId: string, action: GmsEdit, d: { dailyBudget?: number; start?: string; end?: string; roasTarget?: number } = {}): Promise<void> {
  await call("/api/v2/ads/edit_gms_product_campaign", {
    ...c,
    method: "POST",
    body: {
      campaign_id: Number(campaignId),
      edit_action: action,
      reference_id: ref(),
      ...(d.dailyBudget != null ? { daily_budget: d.dailyBudget } : {}),
      ...(d.start ? { start_date: d.start } : {}),
      ...(d.end ? { end_date: d.end } : {}),
      ...(d.roasTarget != null ? { roas_target: d.roasTarget } : {}),
    },
  });
}

// ── Rekomendasi ──
export async function recommendedItems(c: C): Promise<{ itemId: string; status: string[]; tags: string[]; ongoing: string[] }[]> {
  const j = await call<{ response?: { item_id: number; item_status_list?: string[]; sku_tag_list?: string[]; ongoing_ad_type_list?: string[] }[] }>(
    "/api/v2/ads/get_recommended_item_list",
    c,
  );
  return arr(j.response).map((r) => ({ itemId: String(r.item_id), status: r.item_status_list ?? [], tags: r.sku_tag_list ?? [], ongoing: r.ongoing_ad_type_list ?? [] }));
}

export async function recommendedKeywords(c: C, itemId: string, input = ""): Promise<{ keyword: string; quality: number; volume: number; bid: number }[]> {
  const j = await call<{ response?: { suggested_keywords?: { keyword: string; quality_score: number; search_volume: number; suggested_bid: number }[] } }>(
    "/api/v2/ads/get_recommended_keyword_list",
    { ...c, query: { item_id: itemId, ...(input ? { input_keyword: input } : {}) } },
  );
  return (j.response?.suggested_keywords ?? []).map((k) => ({ keyword: k.keyword, quality: f(k.quality_score), volume: f(k.search_volume), bid: f(k.suggested_bid) }));
}

export async function recommendedRoas(c: C, itemId: string): Promise<{ low: number; mid: number; high: number }> {
  type B = { value?: number };
  const j = await call<{ response?: { lower_bound?: B; exact?: B; upper_bound?: B } }>("/api/v2/ads/get_product_recommended_roi_target", {
    ...c,
    query: { reference_id: ref(), item_id: itemId },
  });
  return { low: f(j.response?.lower_bound?.value), mid: f(j.response?.exact?.value), high: f(j.response?.upper_bound?.value) };
}

export async function budgetSuggestion(c: C, d: { itemId: string; bidding: "auto" | "manual"; placement: "search" | "discovery" | "all"; roasTarget?: number }) {
  const j = await call<{ response?: { budget?: { recommended_budget?: number; min_budget?: number; max_budget?: number } } }>("/api/v2/ads/get_create_product_ad_budget_suggestion", {
    ...c,
    query: {
      reference_id: ref(),
      product_selection: "manual",
      campaign_placement: d.placement,
      bidding_method: d.bidding,
      item_id: d.itemId,
      ...(d.bidding === "manual" ? { enhanced_cpc: "false" } : {}),
      ...(d.roasTarget ? { roas_target: d.roasTarget } : {}),
    },
  });
  const b = j.response?.budget;
  return { recommended: f(b?.recommended_budget), min: f(b?.min_budget), max: f(b?.max_budget) };
}

// ── Buat / ubah iklan produk ──
export type NewAd = {
  itemId: string;
  budget: number;
  start: string;
  end?: string;
  bidding: "auto" | "manual";
  roasTarget?: number;
  keywords?: { keyword: string; match: "exact" | "broad"; bid: number }[];
};
export async function createProductAd(c: C, d: NewAd): Promise<string> {
  const j = await call<{ response?: { campaign_id?: number } | { campaign_id?: number }[] }>("/api/v2/ads/create_manual_product_ads", {
    ...c,
    method: "POST",
    body: {
      reference_id: ref(),
      budget: d.budget,
      start_date: d.start,
      ...(d.end ? { end_date: d.end } : {}),
      bidding_method: d.bidding,
      item_id: Number(d.itemId),
      ...(d.roasTarget != null ? { roas_target: d.roasTarget } : {}),
      ...(d.bidding === "manual" && d.keywords?.length ? { selected_keywords: d.keywords.map((k) => ({ keyword: k.keyword, match_type: k.match, bid_price_per_click: k.bid })) } : {}),
    },
  });
  const r = Array.isArray(j.response) ? j.response[0] : j.response;
  return String(r?.campaign_id ?? "");
}

export type AdEdit = "start" | "pause" | "resume" | "stop" | "delete" | "change_budget" | "change_duration" | "change_roas_target";
export async function editProductAd(c: C, campaignId: string, action: AdEdit, d: { budget?: number; start?: string; end?: string; roasTarget?: number } = {}): Promise<void> {
  await call("/api/v2/ads/edit_manual_product_ads", {
    ...c,
    method: "POST",
    body: {
      reference_id: ref(),
      campaign_id: Number(campaignId),
      edit_action: action,
      ...(d.budget != null ? { budget: d.budget } : {}),
      ...(d.start ? { start_date: d.start } : {}),
      ...(d.end ? { end_date: d.end } : {}),
      ...(d.roasTarget != null ? { roas_target: d.roasTarget } : {}),
    },
  });
}

export type KeywordEdit = { action: "add" | "delete" | "restore" | "change_bid_price" | "change_match_type"; keyword: string; match?: "exact" | "broad"; bid?: number };
export async function editKeywords(c: C, campaignId: string, edits: KeywordEdit[]): Promise<string[]> {
  const j = await call<{ response?: { failed_edits?: { keyword: string }[] }[] | { failed_edits?: { keyword: string }[] } }>("/api/v2/ads/edit_manual_product_ad_keywords", {
    ...c,
    method: "POST",
    body: {
      reference_id: ref(),
      campaign_id: Number(campaignId),
      selected_keywords: edits.map((e) => ({
        edit_action: e.action,
        keyword: e.keyword,
        ...(e.match ? { match_type: e.match } : {}),
        ...(e.bid != null ? { bid_price_per_click: e.bid } : {}),
      })),
    },
  });
  const r = Array.isArray(j.response) ? j.response : j.response ? [j.response] : [];
  return r.flatMap((x) => x.failed_edits ?? []).map((x) => x.keyword);
}
