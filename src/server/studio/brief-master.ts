// Master data Standardized Content Brief (ketentuan final Zaki, 21 Nov 2026). Disimpan di MediaSettings.extra.briefCfg,
// dikelola admin penuh dari Studio (tab CPR › Master Brief). BRIEF_DEFAULT = seed (migrasi 20261122090000_cpr_brief_master).
// Semua pilihan brief disimpan sebagai master ID, bukan teks.

type Doc = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});

export const VISION = "To Become the Most Trusted Tennis Media Experience.";
export const PILLARS = ["Educate", "Inspire", "Connect", "Convert"];
/** Primary Objective resmi (tetap, bukan master yang bisa ditambah). */
export const PRIMARY: { id: string; l: string }[] = [
  { id: "AWR", l: "Awareness" },
  { id: "ENT", l: "Engagement & Trust" },
  { id: "QIN", l: "Qualified Inquiry" },
  { id: "CNV", l: "Conversion" },
  { id: "RET", l: "Retention" },
];
export const PRIMARY_IDS = PRIMARY.map((p) => p.id);
/** Primary Metrics per Primary Objective; `na` = belum bisa diukur (data/integrasi belum ada) → Not Available. cp = checkpoint evaluasi. */
export const METRICS: Record<string, { k: string; l: string; na?: boolean }[]> = {
  AWR: [{ k: "reach", l: "Reach" }, { k: "nfreach", l: "Non-Follower Reach", na: true }, { k: "views", l: "Views" }],
  ENT: [{ k: "er", l: "Engagement Rate" }, { k: "saves", l: "Saves" }, { k: "shares", l: "Shares" }, { k: "mcom", l: "Meaningful Comments", na: true }],
  QIN: [{ k: "inq", l: "Qualified Inquiries" }, { k: "inqrate", l: "Inquiry Rate" }],
  CNV: [{ k: "orders", l: "Attributed Orders" }, { k: "revenue", l: "Attributed Revenue" }],
  RET: [{ k: "rpr", l: "Repeat Purchase Rate", na: true }, { k: "retc", l: "Returning Customers", na: true }],
};
export const METRIC_CP: Record<string, string> = { AWR: "D+7", ENT: "D+7", QIN: "D+7", CNV: "D+7", RET: "D+30" };
export const AUD_CATS = ["level", "status", "interest", "geo", "need"];
export const EVT_SUBS = ["promo", "community"];

export type Opt = { id: string; l: string; a?: boolean; d?: string };
export type CObj = Opt & { p: string };
export type Lib = Opt & { t: string[]; p: string[]; o?: string[] };
export type Preset = { p: string; s: string[]; km: string; hk: string; ct: string };
export type BriefCfg = { v: number; cobj: CObj[]; aud: { k: string; l: string; o: Opt[] }[]; km: Lib[]; hk: Lib[]; ct: Lib[]; presets: Record<string, Preset> };

const o = (id: string, l: string): Opt => ({ id, l, a: true });
const co = (p: string, id: string, l: string): CObj => ({ id: p + "-" + id, l, p, a: true });
const lib = (id: string, l: string, d: string, t: string[], p: string[]): Lib => ({ id, l, d, t, p, a: true });
export const BRIEF_DEFAULT: BriefCfg = {
  v: 1,
  cobj: [
    co("AWR", "BI", "Brand Introduction"), co("AWR", "PL", "Product Launch Awareness"), co("AWR", "CA", "Campaign Awareness"), co("AWR", "AE", "Audience Expansion"),
    co("ENT", "PE", "Product Education"), co("ENT", "PC", "Product Comparison"), co("ENT", "BG", "Buying Guidance"), co("ENT", "BC", "Brand Credibility"), co("ENT", "CI", "Community Interaction"),
    co("QIN", "PC", "Product Consultation"), co("QIN", "SI", "Stock Inquiry"), co("QIN", "PI", "Price Inquiry"), co("QIN", "PR", "Product Recommendation"), co("QIN", "SV", "Store Visit Inquiry"),
    co("CNV", "PP", "Product Purchase"), co("CNV", "PM", "Promotional Purchase"), co("CNV", "MC", "Marketplace Checkout"), co("CNV", "IS", "In-Store Purchase"),
    co("RET", "PC", "Product Care Education"), co("RET", "RP", "Repeat Purchase"), co("RET", "CR", "Customer Re-engagement"), co("RET", "CP", "Complementary Product Purchase"),
  ],
  aud: [
    { k: "level", l: "Player Level", o: [o("LV-BEG", "Beginner"), o("LV-INT", "Intermediate"), o("LV-ADV", "Advanced"), o("LV-CMP", "Competitive")] },
    { k: "status", l: "Customer Status", o: [o("CS-NEW", "New Audience"), o("CS-POT", "Potential Buyer"), o("CS-EXI", "Existing Customer"), o("CS-LOY", "Loyal Customer")] },
    { k: "interest", l: "Product Interest", o: [o("PI-RKT", "Racket"), o("PI-SHO", "Shoes"), o("PI-BAG", "Tennis Bag"), o("PI-APP", "Apparel"), o("PI-ACC", "Accessories")] },
    { k: "geo", l: "Geographic Target", o: [o("GE-NAS", "Nasional"), o("GE-YOG", "Yogyakarta"), o("GE-SOL", "Solo"), o("GE-SMG", "Semarang")] },
    { k: "need", l: "Main Customer Need", o: [o("CN-LRN", "Belajar tenis"), o("CN-GER", "Memilih perlengkapan"), o("CN-PRF", "Meningkatkan performa"), o("CN-PRO", "Mencari promo"), o("CN-CAR", "Merawat perlengkapan")] },
  ],
  // Kategori Key Message / Hook / CTA dari preset resmi; kecocokan jenis & Primary Objective mengikuti preset (primary + secondary).
  km: [
    lib("KM-PCF", "Purchase Confidence", "Audiens yakin produk ini tepat untuk dibeli", ["igf"], ["QIN", "ENT"]),
    lib("KM-PED", "Product Education", "Audiens memahami fungsi dan kegunaan produk", ["vpr", "vrv"], ["AWR", "QIN", "ENT"]),
    lib("KM-PDF", "Product Differentiation", "Audiens memahami pembeda produk dari pilihan lain", ["vrv"], ["ENT", "QIN"]),
    lib("KM-PRM", "Promotion", "Audiens mengetahui promo yang sedang berjalan", ["evt"], ["CNV", "AWR"]),
    lib("KM-BTR", "Brand Trust", "Audiens semakin percaya pada Tirtonic", ["evt"], ["ENT", "AWR"]),
    lib("KM-CEX", "Community Experience", "Audiens merasakan pengalaman komunitas tenis Tirtonic", ["evt"], ["ENT", "AWR"]),
  ],
  hk: [
    lib("HK-PHL", "Product Highlight", "Membuka dengan sisi paling menarik dari produk", ["igf"], ["QIN", "ENT"]),
    lib("HK-FHL", "Feature Highlight", "Membuka dengan satu fitur utama produk", ["vpr"], ["AWR", "QIN"]),
    lib("HK-PSU", "Product Suitability", "Membuka dengan untuk siapa produk ini cocok", ["vrv"], ["ENT", "QIN"]),
    lib("HK-PTS", "Performance Test", "Membuka dengan uji pemakaian produk", ["vrv"], ["ENT", "QIN"]),
    lib("HK-LTO", "Limited-Time Offer", "Membuka dengan penawaran berbatas waktu", ["evt"], ["CNV", "AWR"]),
    lib("HK-CEN", "Community Engagement", "Membuka dengan momen komunitas", ["evt"], ["ENT", "AWR"]),
  ],
  ct: [
    lib("CT-PCS", "Product Consultation", "Mengajak audiens berkonsultasi soal produk", ["igf", "vrv"], ["QIN", "ENT"]),
    lib("CT-PAV", "Product Availability", "Mengajak audiens menanyakan ketersediaan produk", ["vpr"], ["AWR", "QIN"]),
    lib("CT-CPU", "Campaign Purchase", "Mengajak audiens membeli selama campaign", ["evt"], ["CNV", "AWR"]),
    lib("CT-EVP", "Event Participation", "Mengajak audiens ikut serta dalam event", ["evt"], ["ENT", "AWR"]),
  ],
  presets: {
    igf: { p: "QIN", s: ["ENT"], km: "KM-PCF", hk: "HK-PHL", ct: "CT-PCS" },
    vpr: { p: "AWR", s: ["QIN"], km: "KM-PED", hk: "HK-FHL", ct: "CT-PAV" },
    vrv: { p: "ENT", s: ["QIN"], km: "KM-PED", hk: "HK-PSU", ct: "CT-PCS" },
    "evt:promo": { p: "CNV", s: ["AWR"], km: "KM-PRM", hk: "HK-LTO", ct: "CT-CPU" },
    "evt:community": { p: "ENT", s: ["AWR"], km: "KM-BTR", hk: "HK-CEN", ct: "CT-EVP" },
  },
};

const ID_RE = /^[A-Z0-9-]{2,16}$/;
const TYPES = ["igf", "vpr", "vrv", "evt"];
const PRESET_KEYS = ["igf", "vpr", "vrv", "evt:promo", "evt:community"];
function optsWhy(L: unknown, what: string, ids: Set<string>, extra?: (x: Doc) => string | null): string | null {
  if (!Array.isArray(L) || L.length > 60) return what + " tidak valid";
  for (const x of L) {
    const i = obj(x);
    if (!ID_RE.test(s(i.id)) || ids.has(s(i.id))) return what + ": ID tidak valid atau ganda";
    ids.add(s(i.id));
    if (!s(i.l).trim() || s(i.l).length > 60 || s(i.d).length > 200) return what + ": nama 1–60 huruf";
    if (i.a !== undefined && typeof i.a !== "boolean") return what + ": status aktif tidak valid";
    const e = extra?.(i);
    if (e) return what + ": " + e;
  }
  return null;
}
const libWhy = (i: Doc) =>
  !Array.isArray(i.t) || !i.t.length || i.t.some((t) => !TYPES.includes(s(t))) ? "jenis konten tidak valid"
  : !Array.isArray(i.p) || !i.p.length || i.p.some((p) => !PRIMARY_IDS.includes(s(p))) ? "Primary Objective tidak valid"
  : i.o !== undefined && (!Array.isArray(i.o) || i.o.some((x) => !ID_RE.test(s(x)))) ? "Content Objective tidak valid" : null;

/** null = master brief sah. ID yang sudah ada tidak boleh hilang (data kartu memakai ID; nonaktifkan saja). */
export function briefCfgWhy(v: unknown, prev?: unknown): string | null {
  const c = obj(v);
  const ids = new Set<string>();
  const w =
    optsWhy(c.cobj, "Content Objective", ids, (i) => (PRIMARY_IDS.includes(s(i.p)) ? null : "Primary Objective tidak valid")) ??
    (!Array.isArray(c.aud) || c.aud.length !== AUD_CATS.length || c.aud.some((g, n) => s(obj(g).k) !== AUD_CATS[n])
      ? "kategori Target Audience tidak valid"
      : (c.aud as unknown[]).map((g) => optsWhy(obj(g).o, "Target Audience", ids)).find(Boolean) ?? null) ??
    optsWhy(c.km, "Key Message", ids, libWhy) ??
    optsWhy(c.hk, "Hook", ids, libWhy) ??
    optsWhy(c.ct, "CTA", ids, libWhy);
  if (w) return w;
  const P = obj(c.presets);
  for (const k of PRESET_KEYS) {
    const p = obj(P[k]);
    if (!PRIMARY_IDS.includes(s(p.p))) return "preset " + k + ": Primary Objective tidak valid";
    if (!Array.isArray(p.s) || p.s.length > 2 || p.s.some((x) => !PRIMARY_IDS.includes(s(x)) || x === p.p)) return "preset " + k + ": Secondary Objective tidak valid";
    for (const f of ["km", "hk", "ct"]) if (!(c[f] as Doc[]).some((x) => x.id === p[f])) return "preset " + k + ": pilihan " + f + " tidak ada";
  }
  if (c.v !== undefined && (typeof c.v !== "number" || !Number.isInteger(c.v) || c.v < 1)) return "versi master tidak valid";
  if (prev) {
    const old = allIds(briefCfgOf(prev));
    const now = allIds(c as unknown as BriefCfg);
    const gone = [...old].filter((x) => !now.has(x));
    if (gone.length) return "pilihan yang sudah ada tidak boleh dihapus (nonaktifkan saja): " + gone.slice(0, 3).join(", ");
  }
  return null;
}
function allIds(c: BriefCfg): Set<string> {
  return new Set([...c.cobj, ...c.aud.flatMap((g) => g.o), ...c.km, ...c.hk, ...c.ct].map((x) => x.id));
}
export function briefCfgOf(v: unknown): BriefCfg {
  return v && !briefCfgWhy(v) ? (v as BriefCfg) : BRIEF_DEFAULT;
}
const active = (x: { a?: boolean }) => x.a !== false;
export const libOk = (x: Lib | undefined, type: string, primary: string) => !!x && active(x) && x.t.includes(type) && x.p.includes(primary);
export { active as optActive };
