// FlowSpace versi baru (dasbor Tirtonichub, ala Attio): bentuk baris kartu + filter/pencarian murni (diuji di flowspace.test.ts).
// Data sama dengan FlowSpace Studio (MediaTask); aturan pindah tahap tetap di server action media-tasks.ts.

import { IDX, OLD_STATUS, STAGES } from "./schedule";

export type FsTask = {
  id: string; title: string; type: string; cat: string; status: string; itemId: string | null; thumb: string | null;
  producer: string; editor: string; talent: string; script: string;
  shootPlan: string; editPlan: string; postAt: string; postTime: string; deadline: string; readyAt: string;
  meta: boolean; driveUrl: string; note: string; cprId: string;
  brief: "none" | "draft" | "submitted" | "approved" | "revisi"; briefOk: boolean;
  review: "none" | "submitted" | "revision" | "major" | "blocked" | "approved" | "reopened";
  history: { at: number; name?: string; from?: string; to?: string }[];
  createdAt: number; late: boolean;
};
export type FsFilter = { q: string; types: string[]; people: string[]; stages: string[]; showTayang: boolean; lateOnly: boolean };
export const FS_EMPTY: FsFilter = { q: "", types: [], people: [], stages: [], showTayang: false, lateOnly: false };
export type FsView = { id: string; name: string; view: "board" | "table"; filter: FsFilter; sort: { id: string; desc: boolean }[]; hidden: string[] };

type Row = {
  id: string; title: string; type: string; cat: string | null; status: string; itemId: string | null;
  producer: string | null; editor: string | null; talent: string | null; script: string | null; shootPlan: string | null; editPlan: string | null;
  postAt: string | null; postTime: string | null; due: string | null; readyAt: string | null; metaAt: Date | null; driveUrl: string | null; note: string | null;
  history: unknown; extra: unknown; createdAt: Date;
};
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Baris database → kartu FlowSpace. null = tidak ditampilkan (ditangguhkan / digabung). */
export function toFsTask(r: Row, today: string, thumb: string | null): FsTask | null {
  const ex = obj(r.extra);
  if (ex.suspendedAt || ex.mergedInto) return null;
  const status = OLD_STATUS[r.status] ?? r.status;
  const deadline = s(ex.readyBy) || s(r.due);
  const b = obj(ex.brief), q = obj(ex.qa);
  const brief = !ex.brief ? "none" : (["draft", "submitted", "approved", "revisi"].includes(s(b.st)) ? s(b.st) : "draft") as FsTask["brief"];
  const review = (q.sys === 2 ? s(q.st) || "none" : q.st === "ok" ? "approved" : q.st === "revisi" ? "revision" : "none") as FsTask["review"];
  return {
    id: r.id, title: r.title, type: r.type, cat: s(r.cat), status, itemId: r.itemId, thumb,
    producer: s(r.producer), editor: s(r.editor), talent: s(r.talent), script: s(r.script),
    shootPlan: s(r.shootPlan), editPlan: s(r.editPlan), postAt: s(r.postAt), postTime: s(r.postTime), deadline, readyAt: s(r.readyAt),
    meta: !!r.metaAt, driveUrl: s(r.driveUrl), note: s(r.note), cprId: s(ex.cprId),
    brief, briefOk: !!b.ok, review,
    history: Array.isArray(r.history) ? (r.history as FsTask["history"]) : [],
    createdAt: r.createdAt.getTime(),
    late: !!deadline && deadline < today && (IDX[status] ?? 0) < IDX.Ready,
  };
}

/** Filter + pencarian. Tayang disembunyikan kecuali diminta (atau tayang 7 hari terakhir). */
export function applyFilter(ts: FsTask[], f: FsFilter, names: Record<string, string>, today: string): FsTask[] {
  const q = f.q.trim().toLowerCase();
  const week = new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
  return ts.filter((t) => {
    if (t.status === "Tayang" && !f.showTayang && !(t.postAt && t.postAt >= week)) return false;
    if (f.types.length && !f.types.includes(t.type)) return false;
    if (f.people.length && !f.people.some((p) => [t.producer, t.editor, t.talent, t.script].includes(p))) return false;
    if (f.stages.length && !f.stages.includes(t.status)) return false;
    if (f.lateOnly && !t.late) return false;
    if (q) {
      const hay = [t.title, t.cprId, t.cat, t.status, names[t.producer], names[t.editor], names[t.talent], names[t.script]].join(" ").toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

/** Kolom papan: tahap resmi, urut deadline (terlambat dulu), lalu judul. */
export function boardColumns(ts: FsTask[]): { stage: string; tasks: FsTask[] }[] {
  return STAGES.map((stage) => ({
    stage,
    tasks: ts.filter((t) => t.status === stage).sort((a, b) => Number(b.late) - Number(a.late) || (a.deadline || "9").localeCompare(b.deadline || "9") || a.title.localeCompare(b.title)),
  }));
}

/** Validasi tampilan tersimpan (dari klien) sebelum disimpan ke database. */
export function viewWhy(v: unknown): string | null {
  const o = obj(v), f = obj(o.filter);
  if (!/^[a-z0-9]{1,20}$/.test(s(o.id))) return "ID tampilan tidak valid";
  if (!s(o.name).trim() || s(o.name).length > 40) return "nama tampilan 1–40 huruf";
  if (!["board", "table"].includes(s(o.view))) return "jenis tampilan tidak valid";
  if (s(f.q).length > 100) return "pencarian terlalu panjang";
  for (const k of ["types", "people", "stages"]) if (!Array.isArray(f[k]) || (f[k] as unknown[]).length > 12 || (f[k] as unknown[]).some((x) => typeof x !== "string" || x.length > 20)) return "filter tidak valid";
  if (typeof f.showTayang !== "boolean" || typeof f.lateOnly !== "boolean") return "filter tidak valid";
  if (!Array.isArray(o.sort) || o.sort.length > 3 || !Array.isArray(o.hidden) || o.hidden.length > 20) return "urutan/kolom tidak valid";
  return null;
}
