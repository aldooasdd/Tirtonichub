// Content Brief CPR (21 Nov 2026): satu brief per kartu ber-Content ID, disimpan di tasks.brief (milik server).
// Klien hanya mengirim `briefAct`; server yang menulis isi, versi, persetujuan Creative Lead, dan riwayatnya.
// Kartu baru (briefReq) tidak bisa pindah dari Terdata ke Produksi sebelum brief disetujui.

import { needsCpr } from "./cpr";

type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

export const PILLARS = ["Educate", "Inspire", "Connect", "Convert"];
/** Isian teks brief + batas panjang. Semua wajib sebelum diajukan/disetujui. */
export const BRIEF_TEXT: Record<string, number> = { audience: 300, objective: 300, message: 600, hook: 600, direction: 1500, cta: 300 };
export const BRIEF_LBL: Record<string, string> = { pillar: "Content Pillar", audience: "Target Audience", objective: "Content Objective", message: "Key Message", hook: "Hook", direction: "Creative Direction", cta: "CTA", refs: "Referensi visual" };
export const REFS_MAX = 8;
export const BRIEF_LOG_MAX = 40;
const STAGE0 = ["Terdata", "Rencana", "Siap Produksi"];

export type BriefData = { pillar: string; audience: string; objective: string; message: string; hook: string; direction: string; cta: string; refs: string[] };
export type BriefSt = "draft" | "submitted" | "approved" | "revisi";
export type BriefLog = { at: number; by: string; act: "save" | "submit" | "approve" | "revisi"; v: number; note?: string; ch?: string[] };
export type Brief = { st: BriefSt; v: number; data: BriefData; ok: { v: number; data: BriefData; by: string; at: number } | null; by: string; at: number; note: string; log: BriefLog[] };

const EMPTY: BriefData = { pillar: "", audience: "", objective: "", message: "", hook: "", direction: "", cta: "", refs: [] };
function dataOf(v: unknown): BriefData {
  const o = obj(v);
  const d: BriefData = { ...EMPTY, refs: Array.isArray(o.refs) ? o.refs.map(s).filter(Boolean) : [] };
  d.pillar = s(o.pillar);
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

/** null = isi brief sah (boleh belum lengkap untuk draf). */
export function briefDataWhy(v: unknown): string | null {
  const o = obj(v);
  if (Object.keys(o).some((k) => !(k in BRIEF_LBL))) return "isian brief tidak dikenal";
  if (o.pillar != null && s(o.pillar) && !PILLARS.includes(s(o.pillar))) return "Content Pillar harus Educate, Inspire, Connect, atau Convert";
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
export const briefMissing = (d: BriefData) => ["pillar", ...Object.keys(BRIEF_TEXT)].filter((k) => !s((d as Record<string, unknown>)[k]).trim()).map((k) => BRIEF_LBL[k]);
const changed = (a: BriefData, b: BriefData) => (Object.keys(BRIEF_LBL) as (keyof BriefData)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

type Who = { name: string; code: string; full: boolean; staff: boolean };

/**
 * Perintah brief:
 * - `{act:'save', data}` simpan draf (anggota kartu / admin). Mengubah brief yang sudah disetujui membuka versi baru (v+1) yang perlu disetujui ulang;
 *   persetujuan versi sebelumnya tetap tercatat (ok) sehingga produksi yang sudah berjalan tidak terhenti.
 * - `{act:'submit', data?}` ajukan ke Creative Lead (semua isian wajib terisi).
 * - `{act:'approve'}` Creative Lead (admin / Admin 2) menyetujui versi ini.
 * - `{act:'revisi', note}` Creative Lead meminta revisi (catatan wajib).
 */
export function nextBrief(prev: unknown, act: unknown, task: Doc, who: Who, at = Date.now()): Brief | string {
  if (!needsCpr(task.type)) return "Content Brief hanya untuk Foto IG, Video produk, Video review, dan Video event";
  const a = obj(act);
  const p = briefOf(prev);
  const by = who.name || "?";
  const log = (e: Omit<BriefLog, "at" | "by">) => [...p.log, { at, by, ...e }].slice(-BRIEF_LOG_MAX);
  if (a.act === "save" || a.act === "submit") {
    let data = p.data;
    if (a.data !== undefined) {
      const why = briefDataWhy(a.data);
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
    const miss = briefMissing(data);
    if (miss.length) return "lengkapi dulu: " + miss.join(", ");
    if (p.st === "approved" && !ch.length) return "brief versi ini sudah disetujui";
    if (p.st === "submitted" && !ch.length) return "brief sudah diajukan, tunggu Creative Lead";
    return { ...p, data, v, st: "submitted", by, at, note: "", log: log({ act: "submit", v, ...(ch.length ? { ch: ch.map((k) => BRIEF_LBL[k]) } : {}) }) };
  }
  if (a.act === "approve" || a.act === "revisi") {
    if (!who.staff) return "persetujuan brief hanya untuk Creative Lead (admin / Admin 2)";
    if (a.act === "approve") {
      if (p.st === "approved") return "brief versi ini sudah disetujui";
      const miss = briefMissing(p.data);
      if (miss.length) return "brief belum lengkap: " + miss.join(", ");
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
