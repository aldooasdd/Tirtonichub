// Logika murni notifikasi push Studio (tanpa DB), supaya bisa diuji: pilih konten syuting pagi + gabung barang masuk.

const WIB_MS = 7 * 3600_000;
const wib = (d: Date) => new Date(d.getTime() + WIB_MS);

/** 'YYYY-MM-DD' menurut WIB. */
export const wibKey = (d: Date) => wib(d).toISOString().slice(0, 10);

/** Menit sejak tengah malam WIB. */
export const wibMinutes = (d: Date) => {
  const w = wib(d);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
};

/** Jendela kirim notifikasi pagi: 07.00–09.59 WIB (server mati jam 7 → susul sebelum 10.00). */
export const MORNING_FROM = 7 * 60;
export const MORNING_UNTIL = 10 * 60;
export const inMorningWindow = (now: Date) => {
  const m = wibMinutes(now);
  return m >= MORNING_FROM && m < MORNING_UNTIL;
};

export const morningKey = (dayKey: string, userId: string) => `pagi:${dayKey}:${userId}`;

export const TYPE_LABEL: Record<string, string> = {
  ktl: "Foto katalog",
  igf: "Foto Instagram",
  vpr: "Video produk",
  vrv: "Video review",
  evt: "Video event",
  khs: "Video khusus",
  idc: "Video IDCC",
  idf: "Foto IDCC",
  cmp: "Foto campaign/web",
};

export type MTask = {
  type: string;
  title: string;
  status: string;
  shootPlan: string | null;
  producer: string | null;
  talent: string | null;
  script: string | null;
  editor?: string | null;
  readyBy?: string | null;
  due?: string | null;
  createdAt: Date;
};
export type MMember = { userId: string; code: string; name: string; offDays: number[] };
export type Push = { userId: string; title: string; body: string; url: string; wa?: string };

/** Konten hangus 1 bulan setelah dibuat (sama dengan expiryOf di UI): tidak diingatkan lagi. */
export function expired(createdAt: Date, dayKey: string): boolean {
  const c = wibKey(createdAt);
  let y = +c.slice(0, 4);
  let m = +c.slice(5, 7) + 1;
  const d = +c.slice(8);
  if (m > 12) {
    m = 1;
    y++;
  }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const exp = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  return dayKey >= exp;
}

const MAX_LIST = 6;

/** Urutan jenis di WA pagi (permintaan Zaki): Video review, Video produk, Foto IG, Foto katalog, lalu sisanya. */
export const TYPE_ORDER = ["vrv", "vpr", "igf", "ktl", "evt", "idc", "idf", "khs", "cmp"];
const TYPE_EMOJI: Record<string, string> = { vrv: "🎥", vpr: "🎬", igf: "📷", ktl: "🛍️", evt: "🎉", idc: "🎞️", idf: "🖼️", khs: "⭐", cmp: "📣" };
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ACTIVE = new Set(["Terdata", "Diproduksi", "Editing"]);

/** Batas Ready (sama dengan dueOf di UI): readyBy, konten lama = due. */
export const dueOf = (t: MTask) => t.readyBy || t.due || null;

/** "Senin, 16 November 2026" */
export function longDay(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
/** "13 Nov" */
export const shortDay = (dayKey: string) => `${+dayKey.slice(8)} ${BULAN[+dayKey.slice(5, 7) - 1].slice(0, 3)}`;

const typeRank = (t: string) => (TYPE_ORDER.includes(t) ? TYPE_ORDER.indexOf(t) : TYPE_ORDER.length);
const label = (t: string) => TYPE_LABEL[t] ?? t;
const sortTasks = (a: MTask, b: MTask) => typeRank(a.type) - typeRank(b.type) || a.title.localeCompare(b.title);

/** Daftar per jenis: judul jenis tebal + nomor. */
function grouped(list: MTask[], line: (t: MTask) => string, withCount: boolean): string[] {
  const out: string[] = [];
  const types = [...new Set([...list].sort(sortTasks).map((t) => t.type))];
  for (const ty of types) {
    const rows = list.filter((t) => t.type === ty).sort(sortTasks);
    out.push(`${TYPE_EMOJI[ty] ?? "•"} *${label(ty)}${withCount ? ` (${rows.length})` : ""}*`);
    rows.forEach((t, i) => out.push(`${i + 1}. ${line(t)}`));
  }
  return out;
}

export type MorningParts = { day: string; shoot: MTask[]; dueToday: MTask[]; lateShoot: MTask[]; lateUpload: MTask[] };

/** Bagian pesan pagi satu orang. Syuting: produksi/talent/skrip. Deadline & upload: produksi/editor. */
export function morningParts(tasks: MTask[], code: string, day: string): MorningParts {
  const open = tasks.filter((t) => ACTIVE.has(t.status) && !expired(t.createdAt, day));
  const crew = (t: MTask) => t.producer === code || t.talent === code || t.script === code;
  const owner = (t: MTask) => t.producer === code || t.editor === code;
  const lateUpload = open.filter((t) => owner(t) && dueOf(t) && dueOf(t)! < day);
  const up = new Set(lateUpload);
  return {
    day,
    shoot: open.filter((t) => t.status === "Terdata" && crew(t) && t.shootPlan === day),
    dueToday: open.filter((t) => owner(t) && dueOf(t) === day),
    lateShoot: open.filter((t) => t.status === "Terdata" && crew(t) && t.shootPlan && t.shootPlan < day && !up.has(t)),
    lateUpload,
  };
}

/** Teks WhatsApp pagi (format rapi, per jenis). */
export function morningWaText(p: MorningParts, m: MMember, members: MMember[], link: string): string {
  const nameOf = new Map(members.map((x) => [x.code, x.name.split(" ")[0]]));
  const L: string[] = [`📋 *${longDay(p.day)}*`];
  if (p.shoot.length) {
    L.push(`*Syuting hari ini · ${p.shoot.length} konten*`, "");
    const tal = (t: MTask) => (t.talent && t.talent !== m.code && nameOf.get(t.talent) ? ` (talent ${nameOf.get(t.talent)})` : "");
    const g = grouped(p.shoot, (t) => t.title + tal(t), true);
    // baris kosong di antara jenis
    g.forEach((l, i) => {
      if (i && !/^\d+\. /.test(l)) L.push("");
      L.push(l);
    });
  } else L.push("_Tidak ada syuting hari ini._");
  if (p.dueToday.length) {
    L.push("", `⏰ *Deadline Ready hari ini · ${p.dueToday.length} konten*`, "_Harus sudah Ready (file final terunggah) hari ini:_");
    L.push(...grouped(p.dueToday, (t) => `${t.title} (${t.status})`, false));
  }
  const sorted = (l: MTask[]) => [...l].sort(sortTasks);
  if (p.lateShoot.length) {
    L.push("", `⚠️ *Terlambat produksi · ${p.lateShoot.length} konten*`, "_Rencana syuting sudah lewat, masih Terdata:_");
    sorted(p.lateShoot).forEach((t, i) => L.push(`${i + 1}. *${label(t.type)}* – ${t.title} (rencana ${shortDay(t.shootPlan!)})`));
  }
  if (p.lateUpload.length) {
    L.push("", `🚨 *Terlambat upload · ${p.lateUpload.length} konten*`, "_Deadline Ready sudah lewat, file final belum diunggah ke Studio:_");
    sorted(p.lateUpload).forEach((t, i) => L.push(`${i + 1}. *${label(t.type)}* – ${t.title} (deadline ${shortDay(dueOf(t)!)}, ${t.status})`));
  }
  L.push("", `Buka Tirtonic Studio: ${link}`);
  return L.join("\n");
}

/**
 * Notifikasi pagi per anggota: syuting hari ini, deadline Ready hari ini, terlambat produksi, terlambat upload.
 * Kamis tim libur; libur pribadi (offDays 0=Min…6=Sab) dilewati; tanpa isi = tidak dikirim.
 * Tanggal merah tetap dikirim bila ada jadwal (keputusan Zaki).
 */
export function morningPushes(tasks: MTask[], members: MMember[], now: Date): Push[] {
  const day = wibKey(now);
  const dow = wib(now).getUTCDay();
  if (dow === 4) return [];
  const nameOf = new Map(members.map((m) => [m.code, m.name.split(" ")[0]]));
  const base = (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");
  const url = "/studio/?p=pipeline";
  const out: Push[] = [];
  for (const m of members) {
    if (!m.code || m.code.startsWith("~")) continue;
    if ((m.offDays ?? []).includes(dow)) continue;
    const p = morningParts(tasks, m.code, day);
    if (!p.shoot.length && !p.dueToday.length && !p.lateShoot.length && !p.lateUpload.length) continue;
    const line = (t: MTask) => {
      const tal = t.talent && t.talent !== m.code ? nameOf.get(t.talent) : null;
      return `${label(t.type)} – ${t.title}${tal ? ` (talent ${tal})` : ""}`;
    };
    const shoot = [...p.shoot].sort(sortTasks);
    const parts = shoot.slice(0, MAX_LIST).map(line);
    if (shoot.length > MAX_LIST) parts.push(`+${shoot.length - MAX_LIST} lagi`);
    if (p.dueToday.length) parts.push(`${p.dueToday.length} deadline Ready hari ini`);
    if (p.lateShoot.length) parts.push(`${p.lateShoot.length} terlambat produksi`);
    if (p.lateUpload.length) parts.push(`${p.lateUpload.length} terlambat upload`);
    const title = p.shoot.length
      ? `Syuting hari ini · ${p.shoot.length} konten`
      : p.dueToday.length
        ? `Deadline Ready hari ini · ${p.dueToday.length} konten`
        : `Konten terlambat · ${p.lateShoot.length + p.lateUpload.length}`;
    out.push({ userId: m.userId, title, body: parts.join(" · "), url, wa: morningWaText(p, m, members, base + url) });
  }
  return out;
}

/** Barang masuk digabung: kirim bila barang tertua di antrean sudah menunggu ≥ 2 menit. */
export const ITEM_BATCH_MS = 2 * 60_000;
export function itemsReady(queue: { createdAt: Date }[], now: Date): boolean {
  if (!queue.length) return false;
  const oldest = Math.min(...queue.map((q) => q.createdAt.getTime()));
  return now.getTime() - oldest >= ITEM_BATCH_MS;
}

export function itemsMessage(names: string[]): { title: string; body: string } {
  const n = names.length;
  if (n === 1) return { title: "Barang masuk", body: names[0] };
  const shown = names.slice(0, 5).join(", ");
  return { title: `${n} barang masuk`, body: n > 5 ? `${shown}, …` : shown };
}

// ---- WhatsApp (wa.ts) ----
/** Penerima khusus Foto katalog (katalog.ts); nomor WA dari MediaMember.phone. */
export const katalogOnly = () =>
  (process.env.PUSH_KATALOG_EMAILS || "ridho@tirtonichub.com").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function waText(msg: { title: string; body?: string; url: string }): string {
  const base = (process.env.APP_URL || "https://tirtonichub.com").replace(/\/$/, "");
  const link = /^https?:\/\//.test(msg.url) ? msg.url : base + (msg.url.startsWith("/") ? "" : "/") + msg.url;
  return [`*${msg.title}*`, msg.body?.trim(), "", `Buka Tirtonic Studio: ${link}`].filter((x) => x !== undefined && x !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Pisahkan antrean barang masuk: barang biasa ikut WhatsApp, barang dari "+ Konten" FlowSpace tidak. Kelompok kosong dibuang. */
export function itemGroups(queue: { itemId: string; name: string }[], konten: Set<string>) {
  return [true, false]
    .map((wa) => ({ wa, names: queue.filter((q) => konten.has(q.itemId) !== wa).map((q) => q.name) }))
    .filter((g) => g.names.length);
}
