const fmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Format tanggal+jam ke WIB (PRD §16). */
export function fmtWIB(d: Date | string): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}

/** Parse string datetime-local ("YYYY-MM-DDTHH:mm") sebagai WIB, bukan TZ server. */
export function parseWIB(s: string): Date {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  if (hasTz) return new Date(s);
  const withSec = /T\d{2}:\d{2}$/.test(s) ? `${s}:00` : s; // tambah detik bila perlu
  return new Date(`${withSec}+07:00`);
}

/** Waktu relatif singkat (buat feed notif/aktivitas). */
export function timeAgo(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - t.getTime()) / 1000);
  if (s < 60) return "Baru saja";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd} hari lalu`;
  return fmtWIB(t);
}
