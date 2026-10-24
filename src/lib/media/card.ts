// Helper kartu Workflow Hub — port murni dari tirtonic-studio. Fungsi butuh "hari ini" (WIB)
// menerima `today` sebagai argumen agar tetap murni (tak baca jam global).
import { IDX, POSTED, CATS, HAS_SCRIPT, toT, addDays, isOff, avail, pad, type Task } from "./schedule";

export const MEMBER_STAGES = ["Terdata", "Diproduksi", "Editing", "Ready"];

export const REASONS: Record<string, { lbl: string; short: string }> = {
  lupa: { lbl: "Belum pernah / lupa diunggah", short: "Lupa unggah" },
  refresh: { lbl: "Perbarui konten lama", short: "Perbarui konten" },
  idcc: { lbl: "Stok banyak & umur lama", short: "Stok lama · IDCC" },
};

export const open = (t: Task) => t.status !== "Tayang";
export const ready = (t: Task) => IDX[t.status] >= IDX["Ready"];
export const late = (t: Task, today: string) => !ready(t) && !!t.due && t.due < today;

export function slug(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function fileName(t: Task): string {
  const date = t.shotAt || "YYYY-MM-DD";
  const cat = CATS[t.cat || ""] || "umum";
  const end = IDX[t.status] >= IDX["Ready"] ? "_final" : "";
  return date + "_" + t.type + "_" + cat + "_" + (slug(t.title || "") || "judul") + end;
}

const createdDay = (t: Task) => {
  if (!t.createdAt) return "";
  const c = new Date(t.createdAt);
  return c.getUTCFullYear() + "-" + pad(c.getUTCMonth() + 1) + "-" + pad(c.getUTCDate());
};
export function expiryOf(t: Task): string {
  const c = createdDay(t);
  if (!c) return "";
  let y = Number(c.slice(0, 4)),
    m = Number(c.slice(5, 7)) + 1;
  const d = Number(c.slice(8));
  if (m > 12) {
    m = 1;
    y++;
  }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return y + "-" + pad(m) + "-" + pad(Math.min(d, last));
}
export const isExpired = (t: Task, today: string) => {
  const e = expiryOf(t);
  return !!e && today >= e;
};

export const mine = (t: Task, code: string | null) => !!code && [t.producer, t.editor, t.talent, t.script].includes(code);

export function canMove(t: Task, isAdmin: boolean, code: string | null, today: string): boolean {
  if (isExpired(t, today)) return false;
  if (isAdmin) return true;
  return mine(t, code) && !t.metaAt && MEMBER_STAGES.includes(t.status);
}

// skrip siap H-1 sebelum syuting (hari kerja penulis tersedia), tidak di masa lalu
function scriptDay(p: string, shoot: string, today: string): string {
  let d = addDays(shoot, -1);
  for (let i = 0; i < 10; i++, d = addDays(d, -1)) {
    if (!isOff(toT(d)) && avail(p, d)) return d < today ? today : d;
  }
  return addDays(shoot, -1);
}

export type Deadline = { lbl: string; d: string; who?: string | null; later?: boolean; info?: boolean };
export function deadlinesOf(t: Task, today: string): Deadline[] {
  const st = t.status;
  const L: Deadline[] = [];
  if (st === "Terdata") {
    if (t.script && HAS_SCRIPT(t.type)) L.push({ lbl: "Skrip", d: t.shootPlan ? scriptDay(t.script, t.shootPlan, today) : "", who: t.script });
    L.push({ lbl: "Syuting", d: t.shootPlan || "", who: t.producer });
    if (t.talent) L.push({ lbl: "Talent", d: t.shootPlan || "", who: t.talent });
  }
  if (st === "Terdata" || st === "Diproduksi" || st === "Editing") L.push({ lbl: "Edit", d: t.due || t.editPlan || "", who: t.editor, later: st === "Terdata" });
  if (st === "Ready" && POSTED.includes(t.type)) {
    if (!t.metaAt) L.push({ lbl: t.checked ? "Jadwalkan di Meta" : "Cek & jadwalkan", d: t.postAt ? addDays(t.postAt, -1) : "", who: "Z" });
    else L.push({ lbl: "Tayang " + (t.postTime || ""), d: t.postAt || "", who: "Z", info: true });
  }
  return L.filter((x) => x.d);
}
export function deadlineFor(t: Task, today: string, view: string | null): Deadline | undefined {
  const L = deadlinesOf(t, today);
  if (view) return L.find((x) => x.who === view && !x.later) || L.find((x) => x.who === view);
  return L.find((x) => !x.later) || L[0];
}
