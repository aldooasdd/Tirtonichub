// CPR (Content Production Report) tahap 1, sejak 21 Nov 2026: Content ID permanen + QA 6 pemeriksaan per kartu FlowSpace.
// Semua isian CPR milik server: klien hanya mengirim perintah `qaAct`, server yang menulis `qa` dan `cprId`.
// Fungsi murni (diuji di cpr.test.ts); alokasi nomor urut ada di store.ts (allocCprId, transaksi atomik di database).

type Doc = Record<string, unknown>;

/** Jenis konten Studio → kode CPR. CPR hanya untuk Foto IG, Video produk, Video review, Video event (permintaan Zaki 21 Nov 2026). */
export const CPR_TYPE: Record<string, string> = { vpr: "VPD", igf: "FIP", vrv: "VRV", evt: "VEV" };
/** Enam pemeriksaan QA: fakta produk, identitas brand, kreatif/CTA, teknis, hak/klaim, kelengkapan file. */
export const QA_GATES = ["pf", "bi", "cr", "te", "rc", "da"] as const;
export type QaGate = (typeof QA_GATES)[number];
export type QaSt = "pending" | "revisi" | "ok";
export type QaLog = { at: number; by: string; st: QaSt; note: string; fail: QaGate[] };
export type Qa = { st: QaSt; g: Record<QaGate, boolean>; by: string; at: number; round: number; note: string; log: QaLog[] };
export const QA_LOG_MAX = 30;
export const QA_STAGES = ["Editing", "Ready"];

const s = (v: unknown) => (v == null ? "" : String(v));

/** YYMM menurut WIB (UTC+7). */
export function cprYymm(now = Date.now()): string {
  const d = new Date(now + 7 * 3600_000);
  return String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, "0");
}
/** TRT-CPR-VRV-2611-0003. Nomor urut global per bulan, lintas jenis. */
export function cprIdOf(type: string, yymm: string, n: number): string {
  return "TRT-CPR-" + CPR_TYPE[type] + "-" + yymm + "-" + String(n).padStart(4, "0");
}
export const needsCpr = (type: unknown) => !!CPR_TYPE[s(type)];

/** QA tersimpan, dibersihkan dari isi yang tidak sah. */
export function qaOf(v: unknown): Qa {
  const o = v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {};
  const g0 = o.g && typeof o.g === "object" ? (o.g as Doc) : {};
  const g = Object.fromEntries(QA_GATES.map((k) => [k, g0[k] === true])) as Record<QaGate, boolean>;
  const st: QaSt = o.st === "ok" || o.st === "revisi" ? o.st : "pending";
  const log = Array.isArray(o.log) ? (o.log.filter((e) => e && typeof e === "object" && ["ok", "revisi"].includes(s((e as Doc).st))) as QaLog[]) : [];
  return { st, g, by: s(o.by), at: Number(o.at) || 0, round: Math.max(0, Math.floor(Number(o.round) || 0)), note: s(o.note), log };
}

type Who = { name: string; code: string; full: boolean; staff: boolean };

/**
 * Keputusan QA dari kiriman klien `qaAct = { st: 'ok' | 'revisi', g: {pf..da: boolean}, note }`.
 * Mengembalikan QA baru, atau string alasan ditolak.
 * - Hanya admin / Admin 2. Admin 2 tidak boleh meloloskan konten yang ia produksi/edit sendiri.
 * - Hanya saat Editing atau Ready.
 * - Lolos = keenam pemeriksaan dicentang. Revisi = minimal satu tidak dicentang + catatan perbaikan.
 */
export function nextQa(prev: unknown, act: unknown, task: Doc, who: Who, at = Date.now()): Qa | string {
  if (!who.staff) return "QA hanya untuk admin";
  if (!act || typeof act !== "object") return "perintah QA tidak valid";
  const a = act as Doc;
  if (a.st !== "ok" && a.st !== "revisi") return "perintah QA tidak valid";
  const st: QaSt = a.st;
  if (!needsCpr(task.type) || !task.cprId) return "kartu ini tidak memakai QA CPR";
  if (!QA_STAGES.includes(s(task.status))) return "QA hanya saat Editing atau Ready";
  const g0 = a.g && typeof a.g === "object" ? (a.g as Doc) : {};
  const g = Object.fromEntries(QA_GATES.map((k) => [k, g0[k] === true])) as Record<QaGate, boolean>;
  const fail = QA_GATES.filter((k) => !g[k]);
  const note = s(a.note).trim().slice(0, 1000);
  if (st === "ok") {
    if (fail.length) return "QA baru bisa lolos bila keenam pemeriksaan dicentang";
    if (!who.full && [task.producer, task.editor].includes(who.code)) return "konten sendiri harus diloloskan admin lain";
  } else {
    if (!fail.length) return "untuk revisi, hilangkan centang pemeriksaan yang belum lolos";
    if (note.length < 3) return "tulis catatan perbaikan untuk revisi";
  }
  const p = qaOf(prev);
  const by = who.name || "?";
  return { st, g, by, at, round: p.round + 1, note, log: [...p.log, { at, by, st, note, fail }].slice(-QA_LOG_MAX) };
}

/** Kartu ber-QA tidak boleh Tayang atau dijadwalkan di Meta sebelum QA lolos. null = boleh. */
export function qaBlocks(before: Doc | null, after: Doc): string | null {
  if (after.qaReq !== true || !needsCpr(after.type)) return null;
  if (qaOf(after.qa).st === "ok") return null;
  const toTayang = after.status === "Tayang" && before?.status !== "Tayang";
  const toMeta = !!after.metaAt && !before?.metaAt;
  return toTayang || toMeta ? "QA CPR belum lolos (6 pemeriksaan di Detail kartu)" : null;
}
