// Mesin penjadwalan media — port 1:1 dari tirtonic-studio (website/index.html).
// Fungsi murni atas array items/tasks/settings; global `S` asli diganti `ctx`.
// Tanggal berupa string 'YYYY-MM-DD' (hitung hari kerja pakai string, tanpa bug zona waktu).
//
// ponytail: PEOPLE / OFF / caps / DEFAULT_JOB masih kode tetap Z/R/A/S sesuai tim sekarang.
// Pindahkan ke MediaMember/MediaSettings bila anggota tim berubah.

export type Item = {
  id: string;
  cat: string;
  tier?: "EX" | "LS" | "JP" | null;
  qty?: number;
  seasonal?: boolean;
  arrived?: string; // 'YYYY-MM-DD'
  old?: boolean;
};

export type Task = {
  id: string;
  itemId?: string | null;
  type: string;
  status: string;
  source?: string | null;
  reason?: string | null;
  producer?: string | null;
  editor?: string | null;
  talent?: string | null;
  script?: string | null;
  shootPlan?: string | null;
  editPlan?: string | null;
  postAt?: string | null;
  postTime?: string | null;
  due?: string | null;
  target?: string | null;
  locked?: boolean;
  checked?: boolean;
  metaAt?: number; // ms (0 = belum dijadwalkan di Meta)
  eventKey?: string | null;
  cat?: string | null;
  createdAt?: number; // ms
};

export type Settings = { idccDay: number; jobdesk?: Record<string, { prod?: string[]; tal?: string[]; edit?: string[] }> };
export type Ctx = { items: Item[]; tasks: Task[]; settings: Settings };

export const PEOPLE = ["Z", "R", "A", "S"] as const;
export const NAMES: Record<string, string> = { Z: "Zaki", R: "Rayhan", A: "Aulia", S: "Salma" };
export const nm = (c: string) => NAMES[c] || "-";

export const HAS_TALENT = (t: string) => t !== "ktl";
export const HAS_SCRIPT = (t: string) => ["vrv", "evt", "khs", "idc"].includes(t);
export const STAGES = ["Terdata", "Diproduksi", "Editing", "Ready", "Tayang"];
export const OLD_STATUS: Record<string, string> = { Rencana: "Terdata", "Siap Produksi": "Terdata", QC: "Ready", Terjadwal: "Ready" };
export const IDX: Record<string, number> = Object.fromEntries(STAGES.map((s, i) => [s, i]));
export const sched = (t: Task) => t.status === "Tayang" || (t.status === "Ready" && !!t.metaAt);

export type TypeDef = { label: string; prio: number; sla?: number; target?: number };
export const TYPES: Record<string, TypeDef> = {
  ktl: { label: "Foto katalog", prio: 1, sla: 1, target: 0 },
  igf: { label: "Foto Instagram", prio: 2, sla: 1 },
  vpr: { label: "Video produk", prio: 3, sla: 2 },
  vrv: { label: "Video review", prio: 4, sla: 7 },
  evt: { label: "Video event", prio: 2 },
  khs: { label: "Video khusus", prio: 3 },
  idc: { label: "Video IDCC", prio: 3 },
  idf: { label: "Foto IDCC", prio: 3 },
  cmp: { label: "Foto campaign/web", prio: 3 },
};
export const CATS: Record<string, string> = { sepatu: "spt", raket: "rkt", tas: "tas", baju: "bju", celana: "cln", aksesoris: "aks", lainnya: "lnn" };
export const CATLBL: Record<string, string> = { sepatu: "Sepatu", raket: "Raket", tas: "Tas", baju: "Baju", celana: "Celana", aksesoris: "Aksesoris", lainnya: "Lainnya" };
export const GENDER_CATS = ["sepatu", "baju", "celana"];
export const GENDERS: Record<string, string> = { men: "Men", women: "Women", unisex: "Unisex" };
export const HOTCATS = ["raket", "sepatu", "tas"];

// Louis1
export const L1_TYPES = ["ktl", "igf", "vpr", "vrv"];
export const LOUIS: Record<string, { n: string; types: string[] }> = {
  EX: { n: "Eksklusif Produk", types: L1_TYPES },
  LS: { n: "Limited Stock", types: L1_TYPES },
  JP: { n: "Jumlah Produk", types: L1_TYPES },
};
const JP_HIGH = 10;
const JP_WAIT = { hi: 7, lo: 10 };
const JP_LOW = { shoot: 3, post: 5 };
export const tierOf = (i?: Item | null) => (i && LOUIS[i.tier || ""] ? (i.tier as string) : "JP");
export function rankOfItem(i?: Item | null) {
  const k = tierOf(i);
  return k === "EX" ? 0 : k === "LS" ? 1 : (Number((i || {}).qty) || 0) > JP_HIGH ? 2 : 3;
}
export const tierLbl = (i?: Item | null) => (rankOfItem(i) === 2 ? "JP+" : tierOf(i));
const postGap = (r: number) => (r <= 1 ? 1 : 2); // EX/LS: file final H-1, lainnya H-2
export const POSTED = ["igf", "idf", "vpr", "vrv", "evt", "khs", "idc", "cmp"];

const DAY = 864e5;
export const pad = (n: number) => String(n).padStart(2, "0");
export const toT = (s: string) => {
  const p = s.split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
};
export const fromT = (t: number) => {
  const d = new Date(t);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
};
export const isOff = (t: number) => new Date(t).getUTCDay() === 4; // Kamis seluruh tim libur
export function addWork(s: string, n: number) {
  let t = toT(s),
    c = 0;
  while (c < n) {
    t += DAY;
    if (!isOff(t)) c++;
  }
  return fromT(t);
}
export const addDays = (s: string, n: number) => fromT(toT(s) + n * DAY);
export function subWork(s: string, n: number) {
  let t = toT(s),
    c = 0;
  while (c < n) {
    t -= DAY;
    if (!isOff(t)) c++;
  }
  return fromT(t);
}
export function workBetween(a: string, b: string) {
  if (a === b) return 0;
  let sign = 1,
    x = a,
    y = b;
  if (toT(b) < toT(a)) {
    sign = -1;
    x = b;
    y = a;
  }
  let t = toT(x),
    c = 0;
  const e = toT(y);
  while (t < e) {
    t += DAY;
    if (!isOff(t)) c++;
  }
  return c * sign;
}

// libur per orang (0=Min … 6=Sab). ponytail: pindah ke MediaMember.offDays bila tim berubah.
const OFF: Record<string, number[]> = { Z: [4], R: [2, 4], A: [4, 5], S: [4, 5] };
const dowOf = (s: string) => new Date(toT(s)).getUTCDay();
function avail(p: string | null | undefined, s: string) {
  return !p || !(OFF[p] || []).includes(dowOf(s));
}
function nextDayWith(people: string[], from: string) {
  let d = from;
  for (let i = 0; i < 21; i++) {
    if (!isOff(toT(d)) && people.every((p) => avail(p, d))) return d;
    d = addDays(d, 1);
  }
  return from;
}

// kuota tayang per hari: 2 foto IG (09/15) + 2 video apa pun (12/18). Event & IDCC pakai slot video.
export type KindKey = "foto" | "video";
export function kindOf(type: string): KindKey {
  return type === "igf" || type === "cmp" || type === "idf" ? "foto" : "video";
}
export const CAP: Record<string, number> = { foto: 2, video: 2 };
export const SLOT_TIMES: Record<string, string[]> = { foto: ["09:00", "15:00"], video: ["12:00", "18:00"] };
const BULAN_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
// event tetap: video payday diunggah tgl 23 (untuk tgl 25); video tanggal kembar diunggah H-2
export function eventOn(d: string) {
  const out: { key: string; short: string; title: string; note: string }[] = [];
  const m = Number(d.slice(5, 7)),
    dd = Number(d.slice(8));
  if (dd === 23) out.push({ key: "payday-" + d.slice(0, 7), short: "Payday", title: "Payday " + BULAN_FULL[m - 1] + " " + d.slice(0, 4), note: "tayang tgl 23 untuk payday tgl 25" });
  const e = addDays(d, 2);
  const em = Number(e.slice(5, 7)),
    ed = Number(e.slice(8));
  if (em === ed) out.push({ key: "twin-" + e.slice(0, 7), short: em + "." + em, title: "Tanggal kembar " + em + "." + em + " " + e.slice(0, 4), note: "tayang H-2 sebelum " + em + "." + em });
  return out;
}

type Use = { foto: number; video: number; old: number; idc: number; items: string[]; cats: string[]; vt: string[] };
const newUse = (): Use => ({ foto: 0, video: 0, old: 0, idc: 0, items: [], cats: [], vt: [] });
const OLD_PER_DAY = 1;

// kapasitas produksi
const SHOOT_H: Record<string, number> = { idf: 0.5, ktl: 0.25, igf: 0.5, vpr: 0.5, vrv: 1.25, idc: 1, evt: 1.5, khs: 1.5, cmp: 1 };
const EDIT_H: Record<string, number> = { idf: 0.3, ktl: 0.25, igf: 0.3, vpr: 0.75, vrv: 2.5, idc: 2, evt: 2.5, khs: 2, cmp: 0.75 };
const SHOOT_CAP: Record<string, number> = { Z: 1.5, R: 3, A: 3, S: 3 };
const EDIT_CAP: Record<string, number> = { Z: 2, R: 3, A: 3, S: 0 };
const TYPE_CAP: Record<string, number> = { idf: 2, ktl: 12, igf: 4, vpr: 3, vrv: 2, idc: 1, evt: 1, khs: 1, cmp: 2 };
export const DEFAULT_JOB: Record<string, { prod: string[]; tal: string[]; edit: string[] }> = {
  ktl: { prod: ["R", "Z", "A"], tal: [], edit: ["Z", "R"] },
  idf: { prod: ["R", "Z"], tal: ["S", "Z"], edit: ["R", "Z"] },
  igf: { prod: ["R", "Z"], tal: ["S", "Z"], edit: ["R", "Z"] },
  vpr: { prod: ["R"], tal: ["S", "Z"], edit: ["Z", "R"] },
  vrv: { prod: ["A"], tal: ["S"], edit: ["R", "A"] },
  idc: { prod: ["A"], tal: ["S"], edit: ["A"] },
  evt: { prod: ["A"], tal: ["S"], edit: ["A"] },
  khs: { prod: ["A", "R"], tal: ["S"], edit: ["A", "R"] },
  cmp: { prod: ["Z", "R"], tal: ["S", "Z"], edit: ["Z", "R"] },
};
const addH = (m: Record<string, Record<string, number>>, d: string, p: string, h: number) => {
  const x = (m[d] = m[d] || {});
  x[p] = (x[p] || 0) + h;
};
const getH = (m: Record<string, Record<string, number>>, d: string, p: string) => (m[d] && m[d][p]) || 0;

type Sched = {
  itemOf: (id?: string | null) => Item | undefined;
  seasonalActive: () => boolean;
  jpAtLimit: (t: Task, d?: string) => boolean;
  bumpable: (t: Task, rank: number, d?: string) => boolean;
  rankOfTask: (t: Task) => number;
  slotUse: (skip?: (t: Task) => boolean) => Record<string, Use>;
  isIdccDay: (d: string) => boolean;
  dayPlan: (d: string, depth?: number) => { foto: (Task | null)[]; video: (Task | null)[]; extra: Task[] };
  timeOf: (t: Task) => string;
  job: (type: string) => { prod: string[]; tal: string[]; edit: string[] };
  capState: (skip?: (t: Task) => boolean) => CapState;
  scheduleShoot: (st: CapState, type: string, from: string, prodPool?: string[], talPool?: string[], days?: number) => { d: string; prod: string; tal: string } | null;
  scheduleEdit: (st: CapState, type: string, from: string, pool?: string[], days?: number) => { d: string; ed: string } | null;
  computeBalance: (todayStr: string, rollAfter15: boolean) => { t: Task; patch: Partial<Task> }[];
  planBatch: (rows: Item[], base: string, order?: number[], excl?: (t: Task) => boolean) => PlannedItem[];
  fileDue: (t: Task) => string;
};
type CapState = { sh: Record<string, Record<string, number>>; ed: Record<string, Record<string, number>>; ty: Record<string, Record<string, number>> };
export type PlannedTask = { type: string; due: string; late: boolean; target: string; producer: string; editor: string; talent: string; shootPlan: string; editPlan: string; postAt: string };
export type PlannedItem = { i: number; row: Item; key: string; tasks: PlannedTask[]; igfDay?: string };

export function makeScheduler(ctx: Ctx): Sched {
  const S = ctx; // alias agar port 1:1 dari kode asli (S.tasks, S.items, S.settings)
  const itemOf = (id?: string | null) => S.items.find((i) => i.id === id);
  const rankOfTask = (t: Task) => (t.source === "lama" ? 4 : rankOfItem(itemOf(t.itemId)));
  const seasonalActive = () => (S.items || []).some((i) => i.seasonal && tierOf(i) !== "JP" && S.tasks.some((t) => t.itemId === i.id && t.status !== "Tayang"));
  function jpAtLimit(t: Task, d?: string) {
    const it = itemOf(t.itemId);
    if (!it || !d || seasonalActive()) return false;
    return addDays(d, 1) > addWork(it.arrived || d, rankOfItem(it) === 2 ? JP_WAIT.hi : JP_WAIT.lo);
  }
  function bumpable(t: Task, rank: number, d?: string) {
    const r = rankOfTask(t);
    return r > rank && r >= 2 && r < 4 && !t.locked && !t.postTime && !t.metaAt && IDX[t.status] < IDX["Ready"] && !["evt", "idc"].includes(t.type) && !jpAtLimit(t, d || t.postAt || undefined);
  }

  function isIdccDay(d: string) {
    const D = Number(S.settings.idccDay);
    if (dowOf(d) === D && !eventOn(d).length) return true;
    const p = addDays(d, -1);
    return dowOf(p) === D && eventOn(p).length > 0;
  }
  function unfilled(d: string) {
    return eventOn(d).filter((ev) => !S.tasks.some((t) => t.eventKey === ev.key && t.postAt === d)).length + (isIdccDay(d) && !S.tasks.some((t) => t.type === "idc" && t.postAt === d) ? 1 : 0);
  }
  function slotUse(skip?: (t: Task) => boolean) {
    const m: Record<string, Use> = {};
    S.tasks.forEach((t) => {
      if (!t.postAt || !POSTED.includes(t.type) || (skip && skip(t))) return;
      const u = (m[t.postAt] = m[t.postAt] || newUse());
      const k = kindOf(t.type);
      u[k]++;
      if (k === "video") u.vt.push(t.type);
      if (t.itemId) u.items.push(t.itemId);
      if (t.cat) u.cats.push(k + ":" + t.cat);
      if (t.type === "idc") u.idc++;
      else if (t.source === "lama") u.old++;
    });
    return m;
  }
  const capOf = (kind: KindKey, d: string) => CAP[kind] - (kind === "video" ? unfilled(d) : 0);
  function findSlot(kind: KindKey, from: string, key: string | undefined, cat: string | undefined, use: Record<string, Use>, strict: boolean, isOld: boolean, type?: string) {
    for (let i = 0; i < 240; i++) {
      const d = addDays(from, i);
      const u = use[d] || newUse();
      if (key && u.items.includes(key)) continue;
      if (strict && kind === "foto" && cat && u.cats.includes(kind + ":" + cat)) continue;
      if (strict && kind === "video" && type) {
        const pv = use[addDays(d, -1)];
        if (u.vt.includes(type) || (pv && pv.vt.length >= 2 && pv.vt.every((x) => x === type))) continue;
      }
      if (isOld && u.old >= OLD_PER_DAY) continue;
      if (u[kind] < capOf(kind, d)) return d;
    }
    return "";
  }
  function reserveSlot(use: Record<string, Use>, d: string, kind: KindKey, key?: string, cat?: string, isOld?: boolean, type?: string) {
    const u = use[d] || (use[d] = newUse());
    u[kind]++;
    if (kind === "video" && type) u.vt.push(type);
    if (key) u.items.push(key);
    if (cat) u.cats.push(kind + ":" + cat);
    if (isOld) u.old++;
  }
  function pickPost(kind: KindKey, from: string, key: string | undefined, use: Record<string, Use>, cat?: string, isOld?: boolean, type?: string) {
    let d = findSlot(kind, from, key, cat, use, false, !!isOld, type);
    if (d && ((kind === "foto" && cat) || (kind === "video" && type))) {
      const ds = findSlot(kind, from, key, cat, use, true, !!isOld, type);
      if (ds && (toT(ds) - toT(d)) / DAY <= (kind === "video" ? 3 : 1)) d = ds;
    }
    if (d) reserveSlot(use, d, kind, key, cat, isOld, type);
    return d;
  }

  let PLAN_MEMO: Record<string, { foto: (Task | null)[]; video: (Task | null)[]; extra: Task[] }> = {};
  const hashS = (x: string) => {
    let h = 2166136261;
    for (let i = 0; i < x.length; i++) {
      h ^= x.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  function dayPlan(d: string, depth?: number): { foto: (Task | null)[]; video: (Task | null)[]; extra: Task[] } {
    if (PLAN_MEMO[d]) return PLAN_MEMO[d];
    depth = depth || 0;
    const ts = S.tasks.filter((t) => t.postAt === d && POSTED.includes(t.type));
    const out: { foto: (Task | null)[]; video: (Task | null)[]; extra: Task[] } = { foto: [null, null], video: [null, null], extra: [] };
    if (!ts.length || depth > 60) {
      PLAN_MEMO[d] = out;
      return out;
    }
    const prev = dayPlan(addDays(d, -1), depth + 1),
      prev2 = dayPlan(addDays(d, -2), depth + 1);
    (["foto", "video"] as const).forEach((k) => {
      const times = SLOT_TIMES[k];
      const slots: (Task | null)[] = [null, null];
      const rest: Task[] = [];
      ts.filter((t) => kindOf(t.type) === k)
        .sort((a, b) => hashS(d + a.id) - hashS(d + b.id))
        .forEach((t) => {
          const i = times.indexOf(t.postTime || "");
          if (i >= 0 && !slots[i]) slots[i] = t;
          else rest.push(t);
        });
      const key = (t: Task | null) => (t ? (k === "video" ? t.type : t.cat || t.type) : "#");
      const pen = (t: Task | null, i: number) => (key(prev[k][i]) === key(t) ? 2 : 0) + (key(prev2[k][i]) === key(t) ? 1 : 0);
      const free = [0, 1].filter((i) => !slots[i]);
      if (free.length === 2 && rest.length >= 2) {
        const a = rest[0],
          b = rest[1];
        if (pen(b, 0) + pen(a, 1) < pen(a, 0) + pen(b, 1)) {
          slots[0] = b;
          slots[1] = a;
        } else {
          slots[0] = a;
          slots[1] = b;
        }
        rest.splice(0, 2);
      } else if (free.length === 2 && rest.length === 1) {
        const t = rest.shift()!;
        const p0 = pen(t, 0),
          p1 = pen(t, 1);
        slots[p0 < p1 ? 0 : p1 < p0 ? 1 : hashS(d + t.id) % 2] = t;
      } else if (free.length === 1 && rest.length) slots[free[0]] = rest.shift()!;
      out[k] = slots;
      out.extra.push(...rest);
    });
    PLAN_MEMO[d] = out;
    return out;
  }
  function timeOf(t: Task) {
    if (!t || !t.postAt || !POSTED.includes(t.type)) return "";
    const k = kindOf(t.type);
    const i = dayPlan(t.postAt)[k].findIndex((x) => x && x.id === t.id);
    return i >= 0 ? SLOT_TIMES[k][i] : "";
  }
  function pickIdcc(from: string, key: string | undefined, use: Record<string, Use>) {
    for (let i = 0; i < 400; i++) {
      const d = addDays(from, i);
      const u = use[d] || newUse();
      if (isIdccDay(d) && !u.idc && !S.tasks.some((t) => t.type === "idc" && t.postAt === d) && !(key && u.items.includes(key))) {
        const w = use[d] || (use[d] = newUse());
        w.idc++;
        w.video++;
        w.vt.push("idc");
        if (key) w.items.push(key);
        return d;
      }
    }
    return "";
  }

  const fileDue = (t: Task) => (POSTED.includes(t.type) && t.postAt && IDX[t.status] < IDX["Ready"] ? subWork(t.postAt, postGap(rankOfTask(t))) : "");

  function job(type: string) {
    const j = ((S.settings && S.settings.jobdesk) || {})[type] || {};
    const d = DEFAULT_JOB[type] || DEFAULT_JOB.cmp;
    const ok = (a?: string[]) => Array.isArray(a) && a.filter(Boolean).length;
    return { prod: ok(j.prod) ? j.prod!.filter(Boolean) : d.prod, tal: Array.isArray(j.tal) ? j.tal.filter(Boolean) : d.tal, edit: ok(j.edit) ? j.edit!.filter(Boolean) : d.edit };
  }
  function capState(skip?: (t: Task) => boolean): CapState {
    const st: CapState = { sh: {}, ed: {}, ty: {} };
    S.tasks.forEach((t) => {
      if (skip && skip(t)) return;
      if (t.shootPlan && IDX[t.status] <= 0) {
        addH(st.sh, t.shootPlan, t.producer!, SHOOT_H[t.type] || 0.5);
        if (t.talent) addH(st.sh, t.shootPlan, t.talent, SHOOT_H[t.type] || 0.5);
        addH(st.ty, t.shootPlan, t.type, 1);
      }
      if (t.editPlan && IDX[t.status] < IDX["Ready"]) addH(st.ed, t.editPlan, t.editor!, EDIT_H[t.type] || 0.5);
    });
    return st;
  }
  function scheduleShoot(st: CapState, type: string, from: string, prodPool?: string[], talPool?: string[], days?: number) {
    const h = SHOOT_H[type] || 0.5;
    prodPool = prodPool || job(type).prod;
    talPool = talPool || job(type).tal;
    days = days || 90;
    let d = from;
    for (let i = 0; i < days; i++, d = addDays(d, 1)) {
      if (isOff(toT(d)) || getH(st.ty, d, type) >= TYPE_CAP[type]) continue;
      for (const p of prodPool) {
        if (!avail(p, d) || getH(st.sh, d, p) + h > SHOOT_CAP[p]) continue;
        if (!talPool.length) {
          addH(st.sh, d, p, h);
          addH(st.ty, d, type, 1);
          return { d, prod: p, tal: "" };
        }
        const tal = talPool.find((x) => x !== p && avail(x, d) && getH(st.sh, d, x) + h <= SHOOT_CAP[x]);
        if (tal) {
          addH(st.sh, d, p, h);
          addH(st.sh, d, tal, h);
          addH(st.ty, d, type, 1);
          return { d, prod: p, tal };
        }
      }
    }
    return days < 90 ? null : { d: from, prod: prodPool[0], tal: talPool[0] || "" };
  }
  function scheduleEdit(st: CapState, type: string, from: string, pool?: string[], days?: number) {
    const h = EDIT_H[type] || 0.5;
    pool = pool || job(type).edit;
    days = days || 90;
    let d = from;
    for (let i = 0; i < days; i++, d = addDays(d, 1)) {
      if (isOff(toT(d))) continue;
      const p = pool.find((x) => avail(x, d) && getH(st.ed, d, x) + h <= (EDIT_CAP[x] || 0) + 1e-9);
      if (p) {
        addH(st.ed, d, p, h);
        return { d, ed: p };
      }
    }
    return days < 90 ? null : { d: from, ed: pool[0] };
  }

  const prioOf = (t: Task) => rankOfTask(t) * 20 + (t.source === "lama" ? 10 : 0) + (({ ktl: 0, evt: 1, igf: 1, vpr: 2, vrv: 3, khs: 3, cmp: 3, idf: 4, idc: 4 } as Record<string, number>)[t.type] ?? 5);
  function releaseSlot(use: Record<string, Use>, t: Task) {
    const u = use[t.postAt!];
    if (!u) return;
    const k = kindOf(t.type);
    u[k] = Math.max(0, u[k] - 1);
    if (k === "video") {
      const j = u.vt.indexOf(t.type);
      if (j >= 0) u.vt.splice(j, 1);
    }
    const i = u.items.indexOf(t.itemId!);
    if (i >= 0) u.items.splice(i, 1);
    const c = u.cats.indexOf(k + ":" + t.cat);
    if (c >= 0) u.cats.splice(c, 1);
    if (t.type === "idc") u.idc = Math.max(0, u.idc - 1);
    else if (t.source === "lama") u.old = Math.max(0, u.old - 1);
  }

  function computeBalance(todayStr: string, rollAfter15: boolean) {
    const start = rollAfter15 ? addDays(todayStr, 1) : todayStr;
    const st: CapState = { sh: {}, ed: {}, ty: {} };
    const P: Record<string, Partial<Task>> = {};
    const get = (t: Task) => P[t.id] || (P[t.id] = {});
    const cur = <K extends keyof Task>(t: Task, k: K): Task[K] => (P[t.id] && P[t.id][k] !== undefined ? (P[t.id][k] as Task[K]) : t[k]);
    const openT = S.tasks.filter((t) => IDX[t.status] < IDX["Ready"]);
    // 1. syuting
    const moveS: { t: Task; from: string }[] = [];
    openT
      .filter((t) => IDX[t.status] <= 0)
      .sort((a, b) => (a.shootPlan || "9").localeCompare(b.shootPlan || "9") || (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || prioOf(a) - prioOf(b))
      .forEach((t) => {
        const d = t.shootPlan;
        if (!d || d < start) {
          moveS.push({ t, from: start });
          return;
        }
        const h = SHOOT_H[t.type] || 0.5;
        const fits = (p: string, tal?: string | null) => !isOff(toT(d)) && avail(p, d) && getH(st.sh, d, p) + h <= (SHOOT_CAP[p] || 0) + 1e-9 && (!tal || (tal !== p && avail(tal, d) && getH(st.sh, d, tal) + h <= (SHOOT_CAP[tal] || 0) + 1e-9));
        if (t.locked || (getH(st.ty, d, t.type) < TYPE_CAP[t.type] && fits(t.producer!, t.talent))) {
          addH(st.sh, d, t.producer!, SHOOT_H[t.type] || 0.5);
          if (t.talent) addH(st.sh, d, t.talent, h);
          addH(st.ty, d, t.type, 1);
          return;
        }
        const j = job(t.type);
        const r = scheduleShoot(st, t.type, d, j.prod, t.talent ? j.tal : [], 1);
        if (r) {
          Object.assign(get(t), { producer: r.prod, talent: r.tal });
          return;
        }
        moveS.push({ t, from: addDays(d, 1) });
      });
    moveS
      .sort((a, b) => prioOf(a.t) - prioOf(b.t))
      .forEach(({ t, from }) => {
        const j = job(t.type);
        const r = scheduleShoot(st, t.type, from, j.prod, t.talent || j.tal.length ? j.tal : [])!;
        Object.assign(get(t), { shootPlan: r.d, producer: r.prod, talent: r.tal });
      });
    // 2. editing
    const moveE: { t: Task; from: string }[] = [];
    openT
      .slice()
      .sort((a, b) => ((cur(a, "editPlan") as string) || "9").localeCompare((cur(b, "editPlan") as string) || "9") || prioOf(a) - prioOf(b))
      .forEach((t) => {
        const sd = IDX[t.status] <= 0 ? (cur(t, "shootPlan") as string) : start;
        const min = sd && sd > start ? sd : start;
        const d = t.editPlan;
        if (!d || d < min) {
          moveE.push({ t, from: min });
          return;
        }
        const h = EDIT_H[t.type] || 0.5;
        if (t.locked || (!isOff(toT(d)) && avail(t.editor, d) && getH(st.ed, d, t.editor!) + h <= (EDIT_CAP[t.editor!] || 0) + 1e-9)) {
          addH(st.ed, d, t.editor!, h);
          return;
        }
        const r = scheduleEdit(st, t.type, d, job(t.type).edit, 1);
        if (r) {
          get(t).editor = r.ed;
          return;
        }
        moveE.push({ t, from: addDays(d, 1) });
      });
    moveE
      .sort((a, b) => prioOf(a.t) - prioOf(b.t))
      .forEach(({ t, from }) => {
        const r = scheduleEdit(st, t.type, from)!;
        Object.assign(get(t), { editPlan: r.d, editor: r.ed });
      });
    // 3. batas siap & tanggal tayang
    const use = slotUse();
    openT.forEach((t) => {
      const e = cur(t, "editPlan") as string;
      if (!e) return;
      if (t.due && e > t.due) get(t).due = e;
      const gp = postGap(rankOfTask(t));
      if (POSTED.includes(t.type) && t.type !== "evt" && t.postAt && t.postAt < addDays(e, gp)) {
        releaseSlot(use, t);
        get(t).postAt = t.type === "idc" ? pickIdcc(addDays(e, gp), t.itemId || undefined, use) : pickPost(kindOf(t.type), addDays(e, gp), t.itemId || undefined, use, t.cat || undefined, t.source === "lama", t.type);
        if (t.postTime) get(t).postTime = "";
      }
    });
    // 4. Louis1: hari kelebihan slot karena EX/LS → konten JP paling bawah digeser
    Object.keys(use)
      .sort()
      .forEach((d) =>
        (["foto", "video"] as const).forEach((k) => {
          let over = use[d][k] - capOf(k, d);
          if (over <= 0) return;
          if (!S.tasks.some((x) => cur(x, "postAt") === d && kindOf(x.type) === k && POSTED.includes(x.type) && rankOfTask(x) <= 1)) return;
          const cand = openT.filter((t) => cur(t, "postAt") === d && kindOf(t.type) === k && POSTED.includes(t.type) && bumpable(t, 1, d)).sort((a, b) => rankOfTask(b) - rankOfTask(a) || (b.createdAt || 0) - (a.createdAt || 0));
          for (const t of cand) {
            if (over <= 0) break;
            releaseSlot(use, Object.assign({}, t, { postAt: d }));
            get(t).postAt = pickPost(k, addDays(d, 1), t.itemId || undefined, use, t.cat || undefined, false, t.type);
            if (t.postTime) get(t).postTime = "";
            over--;
          }
        }),
      );
    return Object.keys(P)
      .map((id) => {
        const t = S.tasks.find((x) => x.id === id)!;
        const patch: Partial<Task> = {};
        (Object.keys(P[id]) as (keyof Task)[]).forEach((k) => {
          if ((t[k] || "") !== (P[id][k] || "")) (patch as Record<string, unknown>)[k] = P[id][k];
        });
        return { t, patch };
      })
      .filter((c) => Object.keys(c.patch).length);
  }

  // urutan selang-seling antar kategori dari urutan acak
  function interleave(rows: Item[], order: number[]) {
    const g: Record<string, number[]> = {};
    order.forEach((i) => (g[rows[i].cat] = g[rows[i].cat] || []).push(i));
    const gs = Object.values(g).sort((a, b) => b.length - a.length);
    const out: number[] = [];
    while (gs.some((x) => x.length)) gs.forEach((x) => x.length && out.push(x.shift()!));
    return out;
  }
  function planBatch(rows: Item[], base: string, order?: number[], excl?: (t: Task) => boolean): PlannedItem[] {
    const rk = Math.min(...rows.map(rankOfItem));
    const skip = (t: Task) => bumpable(t, rk) || (!!excl && excl(t));
    const st = capState(skip);
    const use = slotUse(skip);
    const b0 = nextDayWith([], base);
    const seq = interleave(rows, order && order.length === rows.length ? order : rows.map((_, i) => i));
    const items: PlannedItem[] = seq.map((i) => ({ i, row: rows[i], key: "__new" + i, tasks: [] }));
    ["ktl", "igf", "vpr", "vrv"].forEach((t) =>
      items.forEach((it) => {
        const r = it.row;
        if (!LOUIS[tierOf(r)].types.includes(t)) return;
        const slow = t !== "ktl" && rankOfItem(r) === 3;
        const s0 = slow ? nextDayWith([], addWork(base, JP_LOW.shoot)) : b0;
        const from = t === "vrv" ? addDays(s0, 1) : t === "vpr" && it.igfDay ? it.igfDay : s0;
        const sh = scheduleShoot(st, t, from)!;
        if (t === "igf") it.igfDay = sh.d;
        const ed = scheduleEdit(st, t, sh.d)!;
        const T = TYPES[t],
          sla = slow ? ed.d : addWork(base, T.sla!);
        const due = ed.d > sla ? ed.d : sla;
        let pf = addDays(ed.d, postGap(rankOfItem(r)));
        if (slow && pf < addWork(base, JP_LOW.post)) pf = addWork(base, JP_LOW.post);
        const post = POSTED.includes(t) ? pickPost(kindOf(t), pf, it.key, use, r.cat, false, t) : "";
        it.tasks.push({ type: t, due, late: ed.d > sla, target: T.target == null ? "" : T.target === 0 ? b0 : addWork(base, T.target), producer: sh.prod, editor: ed.ed, talent: sh.tal, shootPlan: sh.d, editPlan: ed.d, postAt: post });
      }),
    );
    return items;
  }

  return { itemOf, seasonalActive, jpAtLimit, bumpable, rankOfTask, slotUse, isIdccDay, dayPlan, timeOf, job, capState, scheduleShoot, scheduleEdit, computeBalance, planBatch, fileDue };
}
