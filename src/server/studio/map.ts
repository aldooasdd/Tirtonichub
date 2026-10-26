// Konversi dokumen UI Tirtonic Studio (bentuk Firestore lama) <-> baris Prisma.
// Isian yang punya kolom ditulis ke kolomnya; sisanya disimpan utuh di `extra` supaya tidak ada yang hilang.

import type { Doc } from "./rules";

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
const toDate = (s: unknown) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T00:00:00.000Z") : null);
const ms = (d: Date | null | undefined) => (d ? d.getTime() : 0);
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown, def = 0) => (Number.isFinite(Number(v)) ? Number(v) : def);
function split(doc: Doc, known: string[]) {
  const extra: Doc = {};
  for (const [k, v] of Object.entries(doc)) if (!known.includes(k) && k !== "id" && v !== undefined) extra[k] = v;
  return extra;
}
const extraOf = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

// ---------- items ----------
const ITEM_KEYS = ["name", "color", "cat", "gender", "qty", "arrived", "tier", "seasonal", "old", "thumb", "scheduled", "createdAt", "updatedAt"];
type ItemRow = { name: string; color: string | null; cat: string | null; gender: string | null; qty: number; arrived: Date; tier: string; seasonal: boolean; old: boolean; thumb: string | null; scheduled: boolean; extra: unknown; createdAt: Date; updatedAt: Date };
export function itemToDoc(r: ItemRow): Doc {
  return { ...extraOf(r.extra), name: r.name, color: r.color ?? "", cat: r.cat ?? "", gender: r.gender ?? "", qty: r.qty, arrived: ymd(r.arrived), tier: r.tier, seasonal: r.seasonal, old: r.old, thumb: r.thumb ?? "", scheduled: r.scheduled, createdAt: ms(r.createdAt), updatedAt: ms(r.updatedAt) };
}
export function itemFromDoc(d: Doc) {
  const tier = ["EX", "LS", "JP"].includes(String(d.tier)) ? (d.tier as "EX" | "LS" | "JP") : "JP";
  return {
    name: String(d.name ?? "").slice(0, 300) || "Tanpa nama",
    color: s(d.color),
    cat: d.cat ? String(d.cat) : null,
    gender: d.gender ? String(d.gender) : null,
    qty: Math.max(0, Math.round(n(d.qty))),
    arrived: toDate(d.arrived) ?? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z"),
    tier,
    seasonal: !!d.seasonal,
    old: !!d.old,
    thumb: d.thumb ? String(d.thumb) : null,
    scheduled: d.scheduled === undefined ? true : !!d.scheduled, // barang dari UI selalu langsung dijadwalkan
    extra: split(d, ITEM_KEYS),
  };
}

// ---------- tasks ----------
const TASK_STR = ["type", "title", "cat", "status", "source", "reason", "producer", "editor", "talent", "script", "shootPlan", "editPlan", "postAt", "postTime", "due", "target", "shotAt", "readyAt", "driveUrl", "caption", "srcDesc", "note", "eventKey", "readyBy"] as const;
const TASK_KEYS = [...TASK_STR, "itemId", "locked", "checked", "metaAt", "history", "createdAt", "updatedAt"];
type TaskRow = Record<(typeof TASK_STR)[number], string | null> & { itemId: string | null; locked: boolean; checked: boolean; metaAt: Date | null; history: unknown; extra: unknown; createdAt: Date; updatedAt: Date };
export function taskToDoc(r: TaskRow): Doc {
  const d: Doc = { ...extraOf(r.extra) };
  for (const k of TASK_STR) d[k] = r[k] ?? "";
  d.itemId = r.itemId ?? "";
  d.locked = r.locked;
  d.checked = r.checked;
  d.metaAt = ms(r.metaAt);
  if (r.history != null) d.history = r.history;
  d.createdAt = ms(r.createdAt);
  d.updatedAt = ms(r.updatedAt);
  return d;
}
export function taskFromDoc(d: Doc) {
  const row: Record<string, unknown> = {};
  for (const k of TASK_STR) row[k] = d[k] == null || d[k] === "" ? null : String(d[k]);
  row.type = String(d.type ?? "khs");
  row.title = String(d.title ?? "").slice(0, 300);
  row.status = String(d.status ?? "Terdata");
  row.locked = !!d.locked;
  row.checked = !!d.checked;
  row.metaAt = d.metaAt ? new Date(n(d.metaAt)) : null;
  row.history = Array.isArray(d.history) ? d.history : undefined;
  row.extra = split(d, TASK_KEYS);
  return { row, itemId: d.itemId ? String(d.itemId) : null };
}

// ---------- members ----------
export type MemberSrc = { email: string; fullName: string; nickname: string | null; createdAt: Date; m: { code: string; role: string; idcc: boolean; phone: string | null; avColor: string; avAnimal: string | null; extra: unknown; updatedAt: Date } | null; boss: boolean };
const ROLE_OUT: Record<string, string> = { ADMIN: "admin", ADMIN2: "admin2", MEMBER: "member" };
export const NO_CODE = (userId: string) => "~" + userId; // kolom code wajib unik; admin tanpa kode jobdesk
export function memberToDoc(src: MemberSrc): Doc {
  const m = src.m;
  const code = m && !m.code.startsWith("~") ? m.code : "";
  const ex = extraOf(m?.extra);
  return {
    name: String(ex.name || src.nickname || src.fullName),
    code,
    role: src.boss ? "admin" : m ? ROLE_OUT[m.role] ?? "member" : "member",
    email: src.email,
    idcc: !!m?.idcc,
    phone: m?.phone ?? "",
    avColor: m?.avColor ?? "lime",
    avAnimal: m?.avAnimal ?? "",
    avPhoto: String(ex.avPhoto ?? ""),
    createdAt: ms(src.createdAt),
    updatedAt: ms(m?.updatedAt),
  };
}
export function memberFromDoc(d: Doc, userId: string) {
  const role = d.role === "admin" ? "ADMIN" : d.role === "admin2" ? "ADMIN2" : "MEMBER";
  return {
    code: d.code ? String(d.code).slice(0, 8) : NO_CODE(userId),
    role: role as "ADMIN" | "ADMIN2" | "MEMBER",
    idcc: !!d.idcc,
    phone: d.phone ? String(d.phone) : null,
    avColor: String(d.avColor || "lime"),
    avAnimal: d.avAnimal ? String(d.avAnimal) : null,
    extra: { name: d.name ? String(d.name) : undefined, avPhoto: d.avPhoto ? String(d.avPhoto) : undefined },
  };
}

// ---------- settings ----------
const SET_KEYS = ["jobdesk", "idccDay", "idccQty", "idccDays", "captionTemplate", "updatedAt"];
type SetRow = { jobdesk: unknown; idccDay: number; idccQty: number; idccDays: number; captionTemplate: string | null; extra: unknown; updatedAt: Date };
export function settingsToDoc(r: SetRow): Doc {
  const d: Doc = { ...extraOf(r.extra), idccDay: r.idccDay, idccQty: r.idccQty, idccDays: r.idccDays, updatedAt: ms(r.updatedAt) };
  if (r.jobdesk != null) d.jobdesk = r.jobdesk;
  if (r.captionTemplate != null) d.captionTemplate = r.captionTemplate;
  return d;
}
export function settingsFromDoc(d: Doc) {
  return {
    jobdesk: d.jobdesk && typeof d.jobdesk === "object" ? d.jobdesk : undefined,
    idccDay: Math.round(n(d.idccDay, 3)),
    idccQty: Math.round(n(d.idccQty, 10)),
    idccDays: Math.round(n(d.idccDays, 90)),
    captionTemplate: d.captionTemplate ? String(d.captionTemplate) : null,
    extra: split(d, SET_KEYS),
  };
}

// ---------- kalender pribadi ----------
export const pcalToDoc = (r: { color: string; notes: string | null; updatedAt: Date }): Doc => ({ color: r.color, notes: r.notes ?? "", updatedAt: ms(r.updatedAt) });
export const pcalEventToDoc = (r: { date: string; title: string; time: string | null; color: string; note: string | null; updatedAt: Date }): Doc => ({ date: r.date, title: r.title, time: r.time ?? "", color: r.color, note: r.note ?? "", updatedAt: ms(r.updatedAt) });
export const pcalEventFromDoc = (d: Doc) => ({ date: String(d.date), title: String(d.title), time: d.time ? String(d.time) : null, color: String(d.color || "lime"), note: d.note ? String(d.note) : null });
