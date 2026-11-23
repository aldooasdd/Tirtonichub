// CPR (Content Production Report), sejak 21 Nov 2026: Content ID permanen + QA dinamis per jenis konten.
// Semua isian CPR milik server: klien hanya mengirim perintah `qaAct` / `briefAct`; server yang menulis `qa`, `brief`, `cprId`.
// Fungsi murni (diuji di cpr.test.ts); alokasi nomor urut ada di store.ts (allocCprId, transaksi atomik di database).

type Doc = Record<string, unknown>;

/** Jenis konten Studio → kode CPR. CPR hanya untuk Foto IG, Video produk, Video review, Video event (permintaan Zaki 21 Nov 2026). */
export const CPR_TYPE: Record<string, string> = { vpr: "VPD", igf: "FIP", vrv: "VRV", evt: "VEV" };
export const QA_LOG_MAX = 40;
export const QA_STAGES = ["Editing", "Ready"];

const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

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

// ---------- Standar QA (bisa diubah admin penuh: settings/main.qaCfg) ----------
/** Indikator skor: k kunci, l nama, w bobot (%), c critical (wajib Pass terpisah), d keterangan. */
export type QaInd = { k: string; l: string; w: number; c?: boolean; d?: string };
export type QaCheck = { k: string; l: string };
export type QaCfg = { v: number; types: Record<string, QaInd[]>; checks: QaCheck[] };

const VPD: QaInd[] = [
  { k: "acc", l: "Product Accuracy", w: 25, c: true, d: "Nama, varian, warna, harga/promo, spesifikasi sesuai produk" },
  { k: "show", l: "Product Showcase", w: 20, d: "Fitur & detail produk terlihat jelas" },
  { k: "prod", l: "Production Quality", w: 20, d: "Cahaya, framing, gerak kamera, editing" },
  { k: "hook", l: "Hook & Storytelling", w: 15, d: "3 detik awal menahan, alur jelas" },
  { k: "cta", l: "CTA & Branding", w: 10, d: "Ajakan jelas, identitas Tirtonic konsisten" },
  { k: "tech", l: "Technical Readiness", w: 10, d: "Rasio, resolusi, audio, subtitle, file final" },
];
export const QA_DEFAULT: QaCfg = {
  v: 1,
  types: {
    igf: [
      { k: "acc", l: "Product Accuracy", w: 25, c: true, d: "Nama, varian, warna, harga/promo sesuai produk" },
      { k: "vis", l: "Visual Quality", w: 25, d: "Ketajaman, cahaya, warna, retouch" },
      { k: "comp", l: "Composition & Branding", w: 20, d: "Komposisi, ruang kosong, identitas Tirtonic" },
      { k: "cap", l: "Caption & CTA", w: 15, d: "Caption jelas, ajakan bertindak" },
      { k: "tech", l: "Technical Readiness", w: 15, d: "Rasio, resolusi, urutan slide, file final" },
    ],
    vpr: VPD,
    vrv: [
      { k: "acc", l: "Accuracy & Credibility", w: 30, c: true, d: "Fakta, spesifikasi, dan klaim bisa dipertanggungjawabkan" },
      { k: "edu", l: "Educational Depth", w: 25, d: "Membantu audiens memahami kelebihan/kekurangan" },
      { k: "str", l: "Structure & Clarity", w: 15, d: "Pembuka, isi, kesimpulan runtut" },
      { k: "demo", l: "Demonstration Evidence", w: 15, d: "Ada bukti pemakaian / perbandingan nyata" },
      { k: "audio", l: "Audio & Technical", w: 10, d: "Suara jernih, gambar stabil, subtitle" },
      { k: "cta", l: "Balanced CTA", w: 5, d: "Ajakan tidak berlebihan, tetap jujur" },
    ],
    // Video event belum punya standar khusus dari Zaki: sementara memakai indikator Video produk (bisa diubah admin).
    evt: VPD,
  },
  checks: [
    { k: "rights", l: "Hak penggunaan aset (musik, foto, talent, logo) aman" },
    { k: "info", l: "Informasi akurat (harga, stok, spesifikasi, klaim)" },
    { k: "brief", l: "Sesuai Content Brief yang disetujui" },
  ],
};

const KEY_RE = /^[a-z0-9]{1,12}$/;
/** null = standar QA sah. */
export function qaCfgWhy(v: unknown): string | null {
  const o = obj(v);
  if (!Object.keys(o).length) return "standar Creative Review kosong";
  const types = obj(o.types);
  for (const t of Object.keys(CPR_TYPE)) {
    const L = types[t];
    if (!Array.isArray(L) || L.length < 2 || L.length > 10) return "setiap jenis konten butuh 2–10 indikator";
    const keys = new Set<string>();
    let sum = 0;
    for (const x of L) {
      const i = obj(x);
      if (!KEY_RE.test(s(i.k)) || keys.has(s(i.k))) return "kunci indikator tidak valid";
      keys.add(s(i.k));
      if (!s(i.l).trim() || s(i.l).length > 60 || s(i.d).length > 200) return "nama indikator 1–60 huruf";
      if (typeof i.w !== "number" || !Number.isInteger(i.w) || i.w < 1 || i.w > 100) return "bobot harus angka bulat 1–100";
      if (i.c !== undefined && typeof i.c !== "boolean") return "tanda critical tidak valid";
      sum += i.w;
    }
    if (sum !== 100) return "total bobot " + CPR_TYPE[t] + " harus 100% (sekarang " + sum + "%)";
  }
  if (Object.keys(types).some((t) => !CPR_TYPE[t])) return "jenis konten tidak dikenal";
  const C = o.checks;
  if (!Array.isArray(C) || C.length < 1 || C.length > 8) return "butuh 1–8 pemeriksaan wajib";
  const ck = new Set<string>();
  for (const x of C) {
    const c = obj(x);
    if (!KEY_RE.test(s(c.k)) || ck.has(s(c.k)) || s(c.k).startsWith("c_")) return "kunci pemeriksaan tidak valid";
    ck.add(s(c.k));
    if (!s(c.l).trim() || s(c.l).length > 120) return "nama pemeriksaan 1–120 huruf";
  }
  if (o.v !== undefined && (typeof o.v !== "number" || !Number.isInteger(o.v) || o.v < 1)) return "versi standar tidak valid";
  return null;
}
/** Standar QA tersimpan bila sah, selain itu bawaan. */
export function qaCfgOf(v: unknown): QaCfg {
  if (qaCfgWhy(v)) return QA_DEFAULT;
  const o = obj(v);
  const types = obj(o.types);
  const ind = (x: unknown): QaInd => {
    const i = obj(x);
    return { k: s(i.k), l: s(i.l).trim(), w: Number(i.w), ...(i.c === true ? { c: true } : {}), ...(s(i.d) ? { d: s(i.d) } : {}) };
  };
  return {
    v: Number(o.v) || 1,
    types: Object.fromEntries(Object.keys(CPR_TYPE).map((t) => [t, (types[t] as unknown[]).map(ind)])),
    checks: (o.checks as unknown[]).map((x) => ({ k: s(obj(x).k), l: s(obj(x).l).trim() })),
  };
}
/** Critical checks (Pass/Fail): pemeriksaan wajib lintas jenis + satu per indikator critical. */
export const critChecks = (inds: QaInd[], checks: QaCheck[]): QaCheck[] => [...checks, ...inds.filter((i) => i.c).map((i) => ({ k: "c_" + i.k, l: i.l + " lolos (critical)" }))];

// ---------- QA per kartu ----------
/** none belum diajukan · submitted menunggu review · revision 50–59 · major <50 · blocked critical gagal · approved · reopened dibuka ulang */
export type QaSt = "none" | "submitted" | "revision" | "major" | "blocked" | "approved" | "reopened";
const QA_STS: QaSt[] = ["none", "submitted", "revision", "major", "blocked", "approved", "reopened"];
export type QaResult = "eligible" | "revision" | "major" | "blocked";
export type QaLog = { at: number; by: string; act: "submit" | "review" | "approve" | "reopen"; ver: number; st: QaSt; score?: number; note?: string; fail?: string[]; exc?: string };
export type QaRev = { by: string; at: number; scores: Record<string, number>; checks: Record<string, boolean>; score: number; result: QaResult; note: string; exc?: string };
export type Qa = {
  sys: 2;
  st: QaSt;
  ver: number; // versi konten (naik setiap pengajuan)
  round: number; // jumlah review
  inds: QaInd[]; // indikator yang dipakai untuk pengajuan ini (salinan standar saat diajukan)
  checks: QaCheck[];
  sub: { by: string; at: number; file: string; briefV: number } | null;
  rev: QaRev | null;
  appBy: string;
  appAt: number;
  log: QaLog[];
};

const indsOf = (v: unknown): QaInd[] =>
  Array.isArray(v) ? v.map(obj).filter((i) => KEY_RE.test(s(i.k))).map((i) => ({ k: s(i.k), l: s(i.l), w: Number(i.w) || 0, ...(i.c === true ? { c: true } : {}), ...(s(i.d) ? { d: s(i.d) } : {}) })) : [];
const checksOf = (v: unknown): QaCheck[] => (Array.isArray(v) ? v.map(obj).filter((c) => s(c.k)).map((c) => ({ k: s(c.k), l: s(c.l) })) : []);

/** QA tersimpan, dibersihkan. Format lama (6 centang, st ok/revisi) dibaca sebagai approved / revision. */
export function qaOf(v: unknown): Qa {
  const o = obj(v);
  const base: Qa = { sys: 2, st: "none", ver: 0, round: 0, inds: [], checks: [], sub: null, rev: null, appBy: "", appAt: 0, log: [] };
  if (o.sys !== 2) {
    if (!Object.keys(o).length) return base;
    const st: QaSt = o.st === "ok" ? "approved" : o.st === "revisi" ? "revision" : "none";
    const log = Array.isArray(o.log)
      ? o.log.map(obj).filter((e) => ["ok", "revisi"].includes(s(e.st))).map((e): QaLog => ({ at: Number(e.at) || 0, by: s(e.by), act: e.st === "ok" ? "approve" : "review", ver: 1, st: e.st === "ok" ? "approved" : "revision", note: s(e.note), fail: Array.isArray(e.fail) ? e.fail.map(s) : [] }))
      : [];
    return { ...base, st, ver: st === "none" ? 0 : 1, round: Math.max(0, Math.floor(Number(o.round) || 0)), appBy: st === "approved" ? s(o.by) : "", appAt: st === "approved" ? Number(o.at) || 0 : 0, log };
  }
  const sub = obj(o.sub);
  const rev = obj(o.rev);
  const num = (x: unknown) => Math.max(0, Math.floor(Number(x) || 0));
  return {
    sys: 2,
    st: QA_STS.includes(o.st as QaSt) ? (o.st as QaSt) : "none",
    ver: num(o.ver),
    round: num(o.round),
    inds: indsOf(o.inds),
    checks: checksOf(o.checks),
    sub: o.sub ? { by: s(sub.by), at: Number(sub.at) || 0, file: s(sub.file), briefV: num(sub.briefV) } : null,
    rev: o.rev
      ? { by: s(rev.by), at: Number(rev.at) || 0, scores: obj(rev.scores) as Record<string, number>, checks: obj(rev.checks) as Record<string, boolean>, score: Number(rev.score) || 0, result: (["eligible", "revision", "major", "blocked"].includes(s(rev.result)) ? rev.result : "major") as QaResult, note: s(rev.note), ...(s(rev.exc) ? { exc: s(rev.exc) } : {}) }
      : null,
    appBy: s(o.appBy),
    appAt: Number(o.appAt) || 0,
    log: Array.isArray(o.log) ? (o.log.filter((e) => e && typeof e === "object") as QaLog[]).slice(-QA_LOG_MAX) : [],
  };
}
export const qaApproved = (v: unknown) => qaOf(v).st === "approved";

/** QA Score = Σ (nilai / 5 × bobot), dibulatkan 1 desimal. */
export function qaScore(inds: QaInd[], scores: Record<string, number>): number {
  const t = inds.reduce((a, i) => a + ((Number(scores[i.k]) || 0) / 5) * i.w, 0);
  return Math.round(t * 10) / 10;
}
/** ≥60 eligible (bila semua critical lolos) · 50–59 revision · <50 major · critical gagal = blocked (keputusan Zaki 23 Nov 2026; dulu 80/70). */
export function qaResult(score: number, failed: number): QaResult {
  if (failed > 0) return "blocked";
  return score >= 60 ? "eligible" : score >= 50 ? "revision" : "major";
}

type Who = { name: string; code: string; full: boolean; staff: boolean };
const isCreator = (task: Doc, who: Who) => !!who.code && [task.producer, task.editor].includes(who.code);
const briefOkV = (b: unknown) => {
  const ok = obj(obj(b).ok);
  return ok.v ? Number(ok.v) || 0 : 0;
};

/**
 * Perintah QA dari klien:
 * - `{act:'submit'}` ajukan QA (anggota kartu / admin): hanya Editing/Ready, file final sudah ada, brief wajib sudah disetujui.
 * - `{act:'review', scores:{k:1..5}, checks:{k:bool}, note, decision:'approve'|'revise', exc?}` admin / Admin 2.
 *   Approve hanya bila skor ≥60 dan semua critical Pass. Admin 2 tidak menyetujui kontennya sendiri; admin penuh (Zaki)
 *   boleh tanpa alasan (keputusan 23 Nov 2026; `exc` opsional tetap dicatat bila dikirim). Revisi wajib catatan.
 * Mengembalikan QA baru, atau string alasan ditolak.
 */
export function nextQa(prev: unknown, act: unknown, task: Doc, who: Who, cfg: QaCfg = QA_DEFAULT, at = Date.now()): Qa | string {
  const a = obj(act);
  if (!needsCpr(task.type) || !task.cprId) return "kartu ini tidak memakai Creative Review";
  if (!QA_STAGES.includes(s(task.status))) return "Creative Review hanya saat Editing atau Ready";
  const p = qaOf(prev);
  const by = who.name || "?";
  if (a.act === "submit") {
    if (!s(task.driveUrl)) return "unggah dulu file final (hasil produksi) sebelum mengajukan Creative Review";
    if (task.briefReq === true && !briefOkV(task.brief)) return "Content Brief belum disetujui Creative Lead";
    if (p.st === "submitted") return "Creative Review sudah diajukan, tunggu review";
    if (p.st === "approved") return "Creative Review sudah Approved";
    const inds = cfg.types[s(task.type)] ?? QA_DEFAULT.types[s(task.type)];
    const ver = p.ver + 1;
    return {
      ...p,
      st: "submitted",
      ver,
      inds,
      checks: critChecks(inds, cfg.checks),
      sub: { by, at, file: s(task.driveUrl), briefV: briefOkV(task.brief) },
      rev: null,
      appBy: "",
      appAt: 0,
      log: [...p.log, { at, by, act: "submit" as const, ver, st: "submitted" as const }].slice(-QA_LOG_MAX),
    };
  }
  if (a.act !== "review") return "perintah Creative Review tidak valid";
  if (!who.staff) return "keputusan Creative Review hanya untuk admin / Admin 2";
  if (p.st !== "submitted") return "Creative Review belum diajukan atau sudah direview";
  const S0 = obj(a.scores), C0 = obj(a.checks);
  const scores: Record<string, number> = {};
  for (const i of p.inds) {
    const v = S0[i.k];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) return "beri nilai 1–5 untuk semua indikator";
    scores[i.k] = v;
  }
  const checks: Record<string, boolean> = {};
  for (const c of p.checks) {
    if (typeof C0[c.k] !== "boolean") return "isi semua critical check (Pass/Fail)";
    checks[c.k] = C0[c.k] as boolean;
  }
  const fail = p.checks.filter((c) => !checks[c.k]).map((c) => c.k);
  const score = qaScore(p.inds, scores);
  const result = qaResult(score, fail.length);
  const note = s(a.note).trim().slice(0, 1000);
  let st: QaSt;
  let exc = "";
  if (a.decision === "approve") {
    if (result === "blocked") return "critical check gagal: Creative Review diblokir, tidak bisa Approved";
    if (result !== "eligible") return "skor " + score + " di bawah 60: belum bisa Approved";
    if (isCreator(task, who)) {
      if (!who.full) return "konten sendiri harus disetujui admin lain";
      exc = s(a.exc).trim().slice(0, 300); // opsional sejak 23 Nov 2026
    }
    st = "approved";
  } else if (a.decision === "revise") {
    if (note.length < 3) return "tulis catatan perbaikan untuk revisi";
    st = result === "eligible" ? "revision" : result;
  } else return "perintah Creative Review tidak valid";
  const rev: QaRev = { by, at, scores, checks, score, result, note, ...(exc ? { exc } : {}) };
  const entry: QaLog = { at, by, act: st === "approved" ? "approve" : "review", ver: p.ver, st, score, note, fail, ...(exc ? { exc } : {}) };
  return { ...p, st, round: p.round + 1, rev, appBy: st === "approved" ? by : "", appAt: st === "approved" ? at : 0, log: [...p.log, entry].slice(-QA_LOG_MAX) };
}

/** Ajukan Creative Review otomatis (keputusan Zaki 23 Nov 2026): kartu masuk Ready, atau file final diganti saat Ready,
 *  langsung diajukan bila syaratnya lengkap (file final, brief disetujui). Status Approved/sudah diajukan tidak disentuh;
 *  syarat belum lengkap = diam (kartu tetap boleh Ready, tombol Ajukan manual tetap ada). null = tidak ada perubahan. */
export function qaAutoSubmit(before: Doc | null, after: Doc, by: string, cfg: QaCfg = QA_DEFAULT, at = Date.now()): Qa | null {
  if (!before || s(after.status) !== "Ready" || !needsCpr(after.type) || !after.cprId) return null;
  const entered = s(before.status) !== "Ready";
  const newFile = s(before.driveUrl) !== s(after.driveUrl);
  if (!entered && !newFile) return null;
  const st = qaOf(after.qa).st;
  if (st === "submitted" || st === "approved") return null;
  const q = nextQa(after.qa, { act: "submit" }, after, { name: by, code: "", full: false, staff: false }, cfg, at);
  return typeof q === "string" ? null : q;
}

/** Perubahan material setelah diajukan/Approved (file final atau informasi produk) membuka QA kembali. null = tidak berubah. */
export const QA_MATERIAL: Record<string, string> = { driveUrl: "file final", title: "judul", productSku: "SKU", itemId: "barang", type: "jenis konten" };
export function qaReopen(prev: unknown, before: Doc | null, after: Doc, by: string, at = Date.now()): Qa | null {
  if (!before || prev === undefined) return null;
  const p = qaOf(prev);
  if (p.st !== "approved" && p.st !== "submitted") return null;
  const ch = Object.keys(QA_MATERIAL).filter((k) => s(before[k]) !== s(after[k]));
  if (!ch.length) return null;
  const note = "Dibuka ulang: " + ch.map((k) => QA_MATERIAL[k]).join(", ") + " berubah";
  return { ...p, st: "reopened", appBy: "", appAt: 0, log: [...p.log, { at, by: by || "?", act: "reopen" as const, ver: p.ver, st: "reopened" as const, note }].slice(-QA_LOG_MAX) };
}

/** Kartu ber-QA tidak boleh Tayang atau dijadwalkan di Meta sebelum QA Approved. null = boleh. */
export function qaBlocks(before: Doc | null, after: Doc): string | null {
  if (after.qaReq !== true || !needsCpr(after.type)) return null;
  if (qaApproved(after.qa)) return null;
  const toTayang = after.status === "Tayang" && before?.status !== "Tayang";
  const toMeta = !!after.metaAt && !before?.metaAt;
  return toTayang || toMeta ? "Creative Review belum Approved (tab Creative Review di Detail kartu)" : null;
}
