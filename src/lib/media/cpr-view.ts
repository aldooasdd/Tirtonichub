// CPR versi baru (beta, hanya baca): bentuk baris Content Registry + ringkasan dashboard dari data yang sama dengan
// tab CPR Studio (MediaTask + koleksi cpr/{id}). Fungsi murni, diuji di cpr-view.test.ts. Tidak menulis data apa pun.

import { OLD_STATUS } from "./schedule";

type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});
export const CPR_TYPES = ["igf", "vpr", "vrv", "evt", "idc", "idf"];
export const CPR_CODE: Record<string, string> = { igf: "FIP", vpr: "VPD", vrv: "VRV", evt: "VEV", idc: "IDCC", idf: "IDCC" };

export type CprSnap = { cp: string; reach: number | null; views: number | null; likes: number | null; comments: number | null; saves: number | null; shares: number | null; stock: number | null; source: string };
export type CprRow = {
  id: string; cprId: string; title: string; type: string; status: string; producer: string; editor: string; itemId: string | null; thumb: string | null;
  createdDay: string; deadline: string; readyAt: string; postAt: string; late: boolean;
  pillar: string; primary: string; briefSt: string; briefOkV: number; brief: Record<string, unknown> | null;
  reviewSt: string; reviewScore: number | null; reviewBy: string; approvedAt: number;
  snaps: CprSnap[]; stock0: number | null; inquiries: number; orders: number; revenue: number;
};
export type CprDocs = { snaps: Map<string, CprSnap[]>; inq: Map<string, number>; ord: Map<string, { n: number; rev: number }> };

/** Koleksi cpr/{id} → per kartu: snapshot (s_{task}_{n}), inquiry (q_), order (o_, Unknown tidak dihitung). */
export function indexCprDocs(rows: { path: string; data: unknown }[]): CprDocs {
  const snaps = new Map<string, CprSnap[]>(), inq = new Map<string, number>(), ord = new Map<string, { n: number; rev: number }>();
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  for (const r of rows) {
    const id = r.path.slice(4), d = obj(r.data), t = s(d.taskId);
    if (!t) continue;
    if (id.startsWith("s_")) snaps.set(t, [...(snaps.get(t) ?? []), { cp: s(d.cp), reach: num(d.reach), views: num(d.views), likes: num(d.likes), comments: num(d.comments), saves: num(d.saves), shares: num(d.shares), stock: num(d.stock), source: s(d.source) }]);
    else if (id.startsWith("q_")) inq.set(t, (inq.get(t) ?? 0) + 1);
    else if (id.startsWith("o_") && d.kind !== "Unknown") { const o = ord.get(t) ?? { n: 0, rev: 0 }; ord.set(t, { n: o.n + 1, rev: o.rev + (Number(d.amount) || 0) }); }
  }
  return { snaps, inq, ord };
}

type TaskRow = { id: string; cprId?: string | null; title: string; type: string; status: string; producer: string | null; editor: string | null; itemId: string | null; due: string | null; readyAt: string | null; postAt: string | null; extra: unknown; createdAt: Date };
const wib = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

export function toCprRow(t: TaskRow, today: string, docs: CprDocs, thumb: string | null): CprRow | null {
  const ex = obj(t.extra);
  if (!CPR_TYPES.includes(t.type) || (["idc", "idf"].includes(t.type) && !(t.cprId ?? ex.cprId)) || ex.suspendedAt || ex.mergedInto) return null;
  const status = OLD_STATUS[t.status] ?? t.status;
  const deadline = s(ex.readyBy) || s(t.due);
  const b = obj(ex.brief), ok = obj(b.ok), okData = ok.v ? obj(ok.data) : null, cur = obj(b.data);
  const q = obj(ex.qa), rev = obj(q.rev);
  const reviewSt = q.sys === 2 ? s(q.st) || "none" : q.st === "ok" ? "approved" : q.st === "revisi" ? "revision" : "none";
  const o = docs.ord.get(t.id);
  return {
    id: t.id, cprId: s(t.cprId ?? ex.cprId), title: t.title, type: t.type, status, producer: s(t.producer), editor: s(t.editor), itemId: t.itemId, thumb,
    createdDay: wib(t.createdAt), deadline, readyAt: s(t.readyAt), postAt: s(t.postAt),
    late: !!deadline && deadline < today && !["Ready", "Tayang"].includes(status),
    pillar: s((okData ?? cur).pillar), primary: s((okData ?? cur).primary),
    briefSt: !ex.brief ? "none" : s(b.st) || "draft", briefOkV: Number(ok.v) || 0, brief: okData,
    reviewSt, reviewScore: rev.score != null ? Number(rev.score) : null, reviewBy: s(rev.by || q.appBy || (q.sys !== 2 ? q.by : "")), approvedAt: Number(q.appAt || (q.st === "ok" ? q.at : 0)) || 0,
    snaps: docs.snaps.get(t.id) ?? [], stock0: obj(ex.stock0).n == null ? null : Number(obj(ex.stock0).n), inquiries: docs.inq.get(t.id) ?? 0, orders: o?.n ?? 0, revenue: o?.rev ?? 0,
  };
}

export type CprKpi = { planned: number; briefApproved: number; reviewApproved: number; published: number; onTime: number; withDeadline: number; inquiries: number; orders: number; revenue: number };
/** Ringkasan per bulan brief (bulan kartu dibuat, WIB) — sama dengan Dashboard CPR Studio. */
export function cprKpi(rows: CprRow[], month: string): CprKpi {
  const T = rows.filter((r) => r.createdDay.startsWith(month));
  const rd = T.filter((r) => r.readyAt && r.deadline);
  return {
    planned: T.length,
    briefApproved: T.filter((r) => r.briefOkV > 0).length,
    reviewApproved: T.filter((r) => r.reviewSt === "approved").length,
    published: T.filter((r) => r.status === "Tayang").length,
    onTime: rd.filter((r) => r.readyAt <= r.deadline).length,
    withDeadline: rd.length,
    inquiries: T.reduce((a, r) => a + r.inquiries, 0),
    orders: T.reduce((a, r) => a + r.orders, 0),
    revenue: T.reduce((a, r) => a + r.revenue, 0),
  };
}
