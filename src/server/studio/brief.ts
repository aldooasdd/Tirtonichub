// Standardized Content Brief CPR (21 Nov 2026): satu brief per kartu ber-Content ID, disimpan di tasks.brief (milik server).
// Klien hanya mengirim `briefAct`; server yang menulis isi, versi, persetujuan Creative Lead, dan riwayatnya.
// Hierarki: Vision → Mission → Content Pillar → Primary Objective → Content Objective → Secondary Objectives → Target Audience
// → Key Message → Hook → CTA → Performance Metrics. Semua klasifikasi disimpan sebagai master ID (brief-master.ts).
// Kartu baru (briefReq) tidak bisa pindah dari Terdata ke Produksi sebelum brief disetujui.

import { needsCpr } from "./cpr";
import { AUD_CATS, BRIEF_DEFAULT, EVT_SUBS, PILLARS, PRIMARY_IDS, libOk, optActive, type BriefCfg } from "./brief-master";

export { PILLARS };
type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

/** Teks pendukung (opsional) + batas panjang. `audience`/`objective` = teks brief versi awal, hanya dibaca. */
export const BRIEF_TEXT: Record<string, number> = { message: 600, hook: 600, cta: 300, direction: 1500, audience: 300, objective: 300 };
export const BRIEF_LBL: Record<string, string> = {
  pillar: "Content Pillar", primary: "Primary Objective", cobj: "Content Objective", sec: "Secondary Objectives", aud: "Target Audience", evtSub: "Subkategori Video event",
  km: "Key Message", hk: "Hook", ct: "CTA", message: "Detail key message", hook: "Naskah hook", cta: "Teks CTA", direction: "Creative Direction", refs: "Referensi visual",
  audience: "Target Audience (teks lama)", objective: "Content Objective (teks lama)",
};
export const REFS_MAX = 8;
export const BRIEF_LOG_MAX = 40;
const STAGE0 = ["Terdata", "Rencana", "Siap Produksi"];

export type Aud = Record<string, string[]>;
export type BriefData = {
  pillar: string; primary: string; cobj: string; sec: string[]; aud: Aud; evtSub: string; km: string; hk: string; ct: string;
  message: string; hook: string; cta: string; direction: string; refs: string[]; audience: string; objective: string;
};
export type BriefSt = "draft" | "submitted" | "approved" | "revisi";
export type BriefLog = { at: number; by: string; act: "save" | "submit" | "approve" | "revisi"; v: number; note?: string; ch?: string[] };
export type Brief = { st: BriefSt; v: number; data: BriefData; ok: { v: number; data: BriefData; by: string; at: number } | null; by: string; at: number; note: string; log: BriefLog[] };

const arr = (v: unknown) => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);
function dataOf(v: unknown): BriefData {
  const o = obj(v);
  const a = obj(o.aud);
  const d = {
    pillar: s(o.pillar), primary: s(o.primary), cobj: s(o.cobj), sec: arr(o.sec), evtSub: s(o.evtSub), km: s(o.km), hk: s(o.hk), ct: s(o.ct),
    aud: Object.fromEntries(AUD_CATS.map((k) => [k, arr(a[k])])), refs: arr(o.refs),
  } as BriefData;
  for (const k of Object.keys(BRIEF_TEXT)) (d as Record<string, unknown>)[k] = s(o[k]).trim();
  return d;
}
export function briefOf(v: unknown): Brief {
  const o = obj(v);
  const ok = obj(o.ok);
  return {
    st: (["draft", "submitted", "approved", "revisi"].includes(s(o.st)) ? o.st : "draft") as BriefSt,
    v: Math.max(1, Math.floor(Number(o.v) || 1)),
    data: dataOf(o.data),
    ok: o.ok ? { v: Number(ok.v) || 1, data: dataOf(ok.data), by: s(ok.by), at: Number(ok.at) || 0 } : null,
    by: s(o.by),
    at: Number(o.at) || 0,
    note: s(o.note),
    log: Array.isArray(o.log) ? (o.log.filter((e) => e && typeof e === "object") as BriefLog[]).slice(-BRIEF_LOG_MAX) : [],
  };
}
export const briefApproved = (v: unknown) => !!briefOf(v).ok;

/** null = isi brief sah (boleh belum lengkap untuk draf). Pilihan harus berupa master ID yang ada (aktif atau sudah dinonaktifkan). */
export function briefDataWhy(v: unknown, cfg: BriefCfg = BRIEF_DEFAULT): string | null {
  const o = obj(v);
  if (Object.keys(o).some((k) => !(k in BRIEF_LBL))) return "isian brief tidak dikenal";
  if (s(o.pillar) && !PILLARS.includes(s(o.pillar))) return "Content Pillar harus Educate, Inspire, Connect, atau Convert";
  if (s(o.primary) && !PRIMARY_IDS.includes(s(o.primary))) return "Primary Objective tidak dikenal";
  if (s(o.cobj) && !cfg.cobj.some((x) => x.id === o.cobj)) return "Content Objective tidak dikenal";
  if (o.sec != null) {
    if (!Array.isArray(o.sec) || o.sec.length > 2 || new Set(o.sec).size !== o.sec.length) return "Secondary Objectives maksimal dua";
    if (o.sec.some((x) => !PRIMARY_IDS.includes(s(x)))) return "Secondary Objective tidak dikenal";
    if (s(o.primary) && o.sec.includes(o.primary)) return "Secondary Objective tidak boleh sama dengan Primary Objective";
  }
  if (o.aud != null) {
    const a = obj(o.aud);
    if (Object.keys(a).some((k) => !AUD_CATS.includes(k))) return "kategori Target Audience tidak dikenal";
    for (const g of cfg.aud) {
      const L = a[g.k];
      if (L == null) continue;
      if (!Array.isArray(L) || L.some((x) => !g.o.some((q) => q.id === x))) return g.l + ": pilihan tidak dikenal";
    }
  }
  if (s(o.evtSub) && !EVT_SUBS.includes(s(o.evtSub))) return "subkategori Video event tidak dikenal";
  for (const f of ["km", "hk", "ct"] as const) if (s(o[f]) && !cfg[f].some((x) => x.id === o[f])) return BRIEF_LBL[f] + " tidak dikenal";
  for (const [k, max] of Object.entries(BRIEF_TEXT)) {
    if (o[k] != null && typeof o[k] !== "string") return BRIEF_LBL[k] + " harus teks";
    if (s(o[k]).length > max) return BRIEF_LBL[k] + " terlalu panjang (maks " + max + " huruf)";
  }
  if (o.refs != null) {
    if (!Array.isArray(o.refs) || o.refs.length > REFS_MAX) return "referensi visual maks " + REFS_MAX + " link";
    if (o.refs.some((u) => typeof u !== "string" || u.length > 500 || !/^https:\/\/\S+$/.test(u))) return "link referensi harus diawali https://";
  }
  return null;
}
/** Isian wajib yang masih kosong. */
export function briefMissing(d: BriefData, type: string): string[] {
  const m: string[] = [];
  if (type === "evt" && !d.evtSub) m.push("evtSub");
  for (const k of ["pillar", "primary", "cobj"] as const) if (!d[k]) m.push(k);
  if (!AUD_CATS.some((k) => d.aud[k]?.length)) m.push("aud");
  for (const k of ["km", "hk", "ct", "direction"] as const) if (!d[k]) m.push(k);
  return m.map((k) => BRIEF_LBL[k]);
}
/** Pilihan yang tidak lagi cocok (mis. setelah Primary Objective diganti). Tidak dihapus diam-diam: harus diganti sebelum diajukan/disetujui. */
export function briefCompat(d: BriefData, type: string, cfg: BriefCfg = BRIEF_DEFAULT): string[] {
  const w: string[] = [];
  const co = cfg.cobj.find((x) => x.id === d.cobj);
  if (co && (co.p !== d.primary || !optActive(co))) w.push("Content Objective \"" + co.l + "\" tidak sesuai Primary Objective" + (optActive(co) ? "" : " / nonaktif"));
  if (d.sec.includes(d.primary)) w.push("Secondary Objective sama dengan Primary Objective");
  for (const g of cfg.aud) for (const id of d.aud[g.k] ?? []) { const q = g.o.find((x) => x.id === id); if (q && !optActive(q)) w.push(g.l + " \"" + q.l + "\" nonaktif"); }
  for (const f of ["km", "hk", "ct"] as const) {
    const x = cfg[f].find((i) => i.id === d[f]);
    if (x && (!libOk(x, type, d.primary) || (x.o?.length && !x.o.includes(d.cobj)))) w.push(BRIEF_LBL[f] + " \"" + x.l + "\" tidak cocok dengan jenis konten / objective");
  }
  return w;
}
const changed = (a: BriefData, b: BriefData) => (Object.keys(BRIEF_LBL) as (keyof BriefData)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

type Who = { name: string; code: string; full: boolean; staff: boolean };

/**
 * Perintah brief:
 * - `{act:'save', data}` simpan draf (anggota kartu / admin). Mengubah brief yang sudah disetujui (termasuk objective) membuka versi baru (v+1)
 *   yang perlu disetujui ulang; persetujuan versi sebelumnya tetap tercatat (ok) sehingga produksi yang sudah berjalan tidak terhenti.
 * - `{act:'submit', data?}` ajukan ke Creative Lead (lengkap & semua pilihan cocok).
 * - `{act:'approve'}` Creative Lead (admin / Admin 2) menyetujui versi ini.
 * - `{act:'revisi', note}` Creative Lead meminta revisi (catatan wajib).
 */
export function nextBrief(prev: unknown, act: unknown, task: Doc, who: Who, cfg: BriefCfg = BRIEF_DEFAULT, at = Date.now()): Brief | string {
  if (!needsCpr(task.type)) return "Content Brief hanya untuk Foto IG, Video produk, Video review, dan Video event";
  const type = s(task.type);
  const a = obj(act);
  const p = briefOf(prev);
  const by = who.name || "?";
  const log = (e: Omit<BriefLog, "at" | "by">) => [...p.log, { at, by, ...e }].slice(-BRIEF_LOG_MAX);
  const ready = (d: BriefData) => {
    const miss = briefMissing(d, type);
    if (miss.length) return "lengkapi dulu: " + miss.join(", ");
    const c = briefCompat(d, type, cfg);
    return c.length ? "perbaiki dulu: " + c.join("; ") : null;
  };
  if (a.act === "save" || a.act === "submit") {
    let data = p.data;
    if (a.data !== undefined) {
      const why = briefDataWhy(a.data, cfg);
      if (why) return why;
      data = dataOf(a.data);
    }
    const ch = changed(p.data, data);
    // versi baru bila isi berubah setelah diajukan/disetujui
    const reopen = ch.length > 0 && (p.st === "approved" || p.st === "submitted");
    const v = reopen && p.st === "approved" ? p.v + 1 : p.v;
    if (a.act === "save") {
      if (!ch.length) return p;
      return { ...p, data, v, st: reopen ? "draft" : p.st === "revisi" ? "revisi" : "draft", by, at, log: log({ act: "save", v, ch: ch.map((k) => BRIEF_LBL[k]) }) };
    }
    const r = ready(data);
    if (r) return r;
    if (p.st === "approved" && !ch.length) return "brief versi ini sudah disetujui";
    if (p.st === "submitted" && !ch.length) return "brief sudah diajukan, tunggu Creative Lead";
    return { ...p, data, v, st: "submitted", by, at, note: "", log: log({ act: "submit", v, ...(ch.length ? { ch: ch.map((k) => BRIEF_LBL[k]) } : {}) }) };
  }
  if (a.act === "approve" || a.act === "revisi") {
    if (!who.staff) return "persetujuan brief hanya untuk Creative Lead (admin / Admin 2)";
    if (a.act === "approve") {
      if (p.st === "approved") return "brief versi ini sudah disetujui";
      const r = ready(p.data);
      if (r) return r.replace("lengkapi dulu", "brief belum lengkap");
      return { ...p, st: "approved", ok: { v: p.v, data: p.data, by, at }, by, at, note: "", log: log({ act: "approve", v: p.v }) };
    }
    const note = s(a.note).trim().slice(0, 1000);
    if (note.length < 3) return "tulis catatan revisi untuk brief";
    if (p.st === "approved") return "brief sudah disetujui; ubah isinya untuk membuat versi baru";
    return { ...p, st: "revisi", note, by, at, log: log({ act: "revisi", v: p.v, note }) };
  }
  return "perintah brief tidak valid";
}

/** Kartu wajib brief tidak boleh keluar dari Terdata (ke Produksi dst.) sebelum brief pernah disetujui. null = boleh. */
export function briefBlocks(before: Doc | null, after: Doc): string | null {
  if (!before || after.briefReq !== true || !needsCpr(after.type)) return null;
  if (!STAGE0.includes(s(before.status)) || STAGE0.includes(s(after.status))) return null;
  return briefApproved(after.brief) ? null : "Content Brief belum disetujui Creative Lead (tab Content Brief di Detail kartu)";
}
