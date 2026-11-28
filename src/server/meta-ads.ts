// Laporan iklan Meta (Facebook & Instagram Ads) lewat Marketing API, baca saja (ads_read).
// Env: META_ADS_TOKEN = token Pengguna Sistem berizin ads_read (akun iklan ditetapkan ke pengguna sistem itu);
//      META_AD_ACCOUNT = "act_123..." (opsional; kosong = akun iklan pertama yang bisa diakses).
const G = "https://graph.facebook.com/v23.0";
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- respons Marketing API

async function api(path: string): Promise<Any> {
  const token = process.env.META_ADS_TOKEN;
  if (!token) throw new Error("META_ADS_TOKEN belum diisi di server.");
  const r = await fetch(`${G}/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000), cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as Any;
  if (!r.ok) throw new Error(j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}`);
  return j;
}

export type AdsRow = { nama: string; status?: string; spend: number; impresi: number; jangkauan: number; klik: number; beli: number; nilaiBeli: number; pesan: number };
const act = (a: Any[] | undefined, ...types: string[]) => (a ?? []).filter((x) => types.includes(x.action_type)).reduce((n, x) => n + Number(x.value || 0), 0);
const row = (r: Any, nama: string): AdsRow => ({
  nama,
  spend: Number(r.spend || 0),
  impresi: Number(r.impressions || 0),
  jangkauan: Number(r.reach || 0),
  klik: Number(r.inline_link_clicks || r.clicks || 0),
  beli: act(r.actions, "purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"),
  nilaiBeli: act(r.action_values, "purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"),
  pesan: act(r.actions, "onsite_conversion.messaging_conversation_started_7d"),
});

/** Ringkasan akun + per kampanye untuk rentang tanggal (YYYY-MM-DD, zona akun iklan). */
export async function metaAds(from: string, to: string): Promise<{ akun: string; mataUang: string; total: AdsRow; kampanye: AdsRow[] }> {
  let id = process.env.META_AD_ACCOUNT;
  if (!id) {
    const a = await api("me/adaccounts?fields=id,name&limit=5");
    id = a.data?.[0]?.id;
    if (!id) throw new Error("Tidak ada akun iklan yang bisa diakses token ini. Tetapkan akun iklan ke pengguna sistem.");
  }
  const tr = encodeURIComponent(JSON.stringify({ since: from, until: to }));
  const f = "spend,impressions,reach,clicks,inline_link_clicks,actions,action_values";
  const [info, tot, kamp] = await Promise.all([
    api(`${id}?fields=name,currency`),
    api(`${id}/insights?fields=${f}&time_range=${tr}`),
    api(`${id}/insights?level=campaign&fields=campaign_name,${f}&time_range=${tr}&limit=100&sort=spend_descending`),
  ]);
  return {
    akun: info.name ?? id,
    mataUang: info.currency ?? "IDR",
    total: row(tot.data?.[0] ?? {}, "Total"),
    kampanye: (kamp.data ?? []).map((r: Any) => row(r, r.campaign_name)),
  };
}
