// Instagram @tirtonic.id lewat Graph API (token Page META_IG_TOKEN): profil, insight, daftar postingan, posting & jadwal.
// Izin token: instagram_basic, instagram_manage_insights, instagram_content_publish, pages_read_engagement.
import { prisma } from "@/server/db";

const G = "https://graph.facebook.com/v23.0";
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- respons Graph API

async function api(path: string, init?: { method: "POST"; body: object }): Promise<Any> {
  const token = process.env.META_IG_TOKEN;
  if (!token) throw new Error("META_IG_TOKEN belum diisi di server.");
  const r = await fetch(`${G}/${path}`, {
    method: init?.method ?? "GET",
    headers: { authorization: `Bearer ${token}`, ...(init ? { "content-type": "application/json" } : {}) },
    body: init ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as Any;
  if (!r.ok) throw new Error(j.error?.error_user_msg || j.error?.message || `HTTP ${r.status}`);
  return j;
}

let ids: Promise<{ pageId: string; igId: string }> | null = null;
/** ID Page & IG dari token Page (disimpan di memori). */
export function igIds() {
  ids ??= api("me?fields=id,instagram_business_account").then((j) => {
    if (!j.instagram_business_account?.id) throw new Error("Page belum tersambung ke akun Instagram bisnis.");
    return { pageId: j.id as string, igId: j.instagram_business_account.id as string };
  }).catch((e) => { ids = null; throw e; });
  return ids;
}

export type IgProfil = { username: string; name: string; followers: number; follows: number; posts: number; pic: string | null };
export async function igProfil(): Promise<IgProfil> {
  const { igId } = await igIds();
  const j = await api(`${igId}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url`);
  return { username: j.username, name: j.name ?? "", followers: j.followers_count ?? 0, follows: j.follows_count ?? 0, posts: j.media_count ?? 0, pic: j.profile_picture_url ?? null };
}

/** Total 30 hari terakhir per metrik akun. Metrik yang ditolak Meta → null. */
export async function igInsight(): Promise<Record<string, number | null>> {
  const { igId } = await igIds();
  const until = Math.floor(Date.now() / 1000);
  const since = until - 29 * 86400;
  const out: Record<string, number | null> = {};
  for (const m of ["reach", "views", "profile_views", "accounts_engaged", "total_interactions", "website_clicks", "follows_and_unfollows"]) {
    out[m] = await api(`${igId}/insights?metric=${m}&period=day&metric_type=total_value&since=${since}&until=${until}`)
      .then((j) => j.data?.[0]?.total_value?.value ?? null)
      .catch(() => null);
  }
  return out;
}

export type IgMedia = { id: string; caption: string; type: string; img: string | null; link: string; at: string; likes: number; comments: number };
export async function igMedia(limit = 24): Promise<IgMedia[]> {
  const { igId } = await igIds();
  const j = await api(`${igId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}`);
  return (j.data ?? []).map((m: Any) => ({ id: m.id, caption: m.caption ?? "", type: m.media_type, img: m.thumbnail_url ?? m.media_url ?? null, link: m.permalink, at: m.timestamp, likes: m.like_count ?? 0, comments: m.comments_count ?? 0 }));
}

const fileUrl = (key: string) => `${(process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "")}/api/file?key=${encodeURIComponent(key)}`;

/** Buat container + terbitkan. Video (REELS) diproses Meta dulu → status PROSES, dicek lagi di tick berikutnya. */
async function proses(p: { id: string; tipe: string; caption: string; keys: unknown; containerId: string | null }) {
  const { igId } = await igIds();
  let container = p.containerId;
  if (!container) {
    const keys = p.keys as string[];
    if (p.tipe === "REELS") container = (await api(`${igId}/media`, { method: "POST", body: { media_type: "REELS", video_url: fileUrl(keys[0]), caption: p.caption } })).id;
    else if (p.tipe === "CAROUSEL") {
      const children: string[] = [];
      for (const k of keys) children.push((await api(`${igId}/media`, { method: "POST", body: { image_url: fileUrl(k), is_carousel_item: true } })).id);
      container = (await api(`${igId}/media`, { method: "POST", body: { media_type: "CAROUSEL", children: children.join(","), caption: p.caption } })).id;
    } else container = (await api(`${igId}/media`, { method: "POST", body: { image_url: fileUrl(keys[0]), caption: p.caption } })).id;
  }
  const st = (await api(`${container}?fields=status_code,status`)) as Any;
  if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Meta menolak file: ${st.status ?? st.status_code}`);
  if (st.status_code && st.status_code !== "FINISHED") {
    await prisma.igPost.update({ where: { id: p.id }, data: { status: "PROSES", containerId: container } });
    return;
  }
  const pub = await api(`${igId}/media_publish`, { method: "POST", body: { creation_id: container } });
  const info = await api(`${pub.id}?fields=permalink`).catch(() => ({}) as Any);
  await prisma.igPost.update({ where: { id: p.id }, data: { status: "TERBIT", containerId: container, igMediaId: pub.id, permalink: info.permalink ?? null, error: null } });
}

export async function terbitkan(id: string): Promise<void> {
  const p = await prisma.igPost.findUnique({ where: { id } });
  if (!p || p.status === "TERBIT") return;
  try {
    await proses(p);
  } catch (e) {
    await prisma.igPost.update({ where: { id }, data: { status: "GAGAL", error: e instanceof Error ? e.message : "Gagal." } });
  }
}

/** Tiap menit (pushTick): posting terjadwal yang sudah waktunya + video yang masih diproses Meta. */
export async function igTick(now = new Date()): Promise<void> {
  if (!process.env.META_IG_TOKEN) return;
  const due = await prisma.igPost.findMany({ where: { OR: [{ status: "TERJADWAL", jadwal: { lte: now } }, { status: "PROSES" }] }, take: 5, orderBy: { jadwal: "asc" } });
  for (const p of due) await terbitkan(p.id);
}

export type IgKomentar = { id: string; user: string; text: string; at: string; likes: number; hidden: boolean; replies: { id: string; user: string; text: string; at: string }[] };

/** Komentar 1 postingan (terbaru dulu) + balasannya. Langsung dari Instagram, jadi komentar lama ikut tampil. */
export async function igKomentar(mediaId: string): Promise<IgKomentar[]> {
  const j = await api(`${mediaId}/comments?fields=id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}&limit=50`);
  return (j.data ?? [])
    .map((c: Any) => ({
      id: c.id,
      user: c.username ?? "",
      text: c.text ?? "",
      at: c.timestamp,
      likes: c.like_count ?? 0,
      hidden: !!c.hidden,
      replies: (c.replies?.data ?? []).map((r: Any) => ({ id: r.id, user: r.username ?? "", text: r.text ?? "", at: r.timestamp })).sort((a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at)),
    }))
    .sort((a: IgKomentar, b: IgKomentar) => b.at.localeCompare(a.at));
}

/** Balas komentar: publik (balasan di postingan) atau dm=true (DM pribadi ke pengomentar, ≤7 hari). */
export async function igBalasKomentar(commentId: string, text: string, dm: boolean): Promise<void> {
  if (dm) {
    const { igId } = await igIds();
    await api(`${igId}/messages`, { method: "POST", body: { recipient: { comment_id: commentId }, message: { text } } });
  } else await api(`${commentId}/replies`, { method: "POST", body: { message: text } });
}

export async function igSembunyikan(commentId: string, hide: boolean): Promise<void> {
  await api(`${commentId}?hide=${hide}`, { method: "POST", body: {} });
}

export async function igPost1(mediaId: string): Promise<IgMedia> {
  const m = await api(`${mediaId}?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count`);
  return { id: m.id, caption: m.caption ?? "", type: m.media_type, img: m.thumbnail_url ?? m.media_url ?? null, link: m.permalink, at: m.timestamp, likes: m.like_count ?? 0, comments: m.comments_count ?? 0 };
}
