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
  createdAt: Date;
};
export type MMember = { userId: string; code: string; name: string; offDays: number[] };
export type Push = { userId: string; title: string; body: string; url: string };

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

/**
 * Notifikasi "Syuting hari ini" per anggota. Kamis tim libur; libur pribadi (offDays 0=Min…6=Sab) dilewati;
 * tanpa tugas = tidak dikirim. Tanggal merah tetap dikirim bila ada jadwal (keputusan Zaki).
 */
export function morningPushes(tasks: MTask[], members: MMember[], now: Date): Push[] {
  const day = wibKey(now);
  const dow = wib(now).getUTCDay();
  if (dow === 4) return [];
  const nameOf = new Map(members.map((m) => [m.code, m.name.split(" ")[0]]));
  const open = tasks.filter((t) => t.status === "Terdata" && t.shootPlan && t.shootPlan <= day && !expired(t.createdAt, day));
  const out: Push[] = [];
  for (const m of members) {
    if (!m.code || m.code.startsWith("~")) continue;
    if ((m.offDays ?? []).includes(dow)) continue;
    const mine = open.filter((t) => t.producer === m.code || t.talent === m.code || t.script === m.code);
    if (!mine.length) continue;
    const today = mine.filter((t) => t.shootPlan === day);
    const late = mine.length - today.length;
    const line = (t: MTask) => {
      const tal = t.talent && t.talent !== m.code ? nameOf.get(t.talent) : null;
      return `${TYPE_LABEL[t.type] ?? t.type} – ${t.title}${tal ? ` (talent ${tal})` : ""}`;
    };
    const parts = today.slice(0, MAX_LIST).map(line);
    if (today.length > MAX_LIST) parts.push(`+${today.length - MAX_LIST} lagi`);
    if (late) parts.push(`${late} terlambat`);
    out.push({ userId: m.userId, title: `Syuting hari ini · ${mine.length} konten`, body: parts.join(" · "), url: "/studio/?p=pipeline" });
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
